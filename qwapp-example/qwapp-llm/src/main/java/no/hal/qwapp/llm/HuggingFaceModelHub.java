package no.hal.qwapp.llm;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.WebApplicationException;

/**
 * Reads models from the public Hugging Face Hub API. Responses are cached for a while,
 * since the API is rate limited and a family is listed in one request.
 */
@ApplicationScoped
public class HuggingFaceModelHub implements ModelHub {

    /** Everything a family is listed with; far smaller than the default response. */
    private static final List<String> LIST_FIELDS = List.of(
            "downloads", "likes", "safetensors", "gated", "createdAt", "lastModified");

    /** Largest page the Hub returns; the families are expected to fit in one. */
    private static final int LIMIT = 1000;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @Inject
    LlmConfig config;

    @Inject
    ObjectMapper objectMapper;

    private record CacheEntry(Instant expires, Object value) {
    }

    @Override
    public List<ModelSummary> listModels(String author, String search, Map<String, List<String>> query) {
        Map<String, List<String>> params = new LinkedHashMap<>(query);
        params.remove("author");
        params.remove("search");
        List<String> filters = new ArrayList<>(List.of("text-generation"));
        for (String filter : params.getOrDefault("filter", List.of())) {
            if (!filters.contains(filter)) {
                filters.add(filter);
            }
        }
        params.put("filter", filters);
        params.put("author", List.of(author));
        params.put("search", List.of(search));
        params.put("sort", List.of("downloads"));
        params.put("direction", List.of("-1"));
        params.put("limit", List.of(String.valueOf(LIMIT)));
        params.put("expand[]", LIST_FIELDS);

        URI uri = uri("/models", params);
        return cached(uri.toString(), () -> {
            JsonNode models = fetch(uri).orElseThrow(() -> new WebApplicationException("Unexpected response from Hugging Face", 502));
            List<ModelSummary> result = new ArrayList<>();
            for (JsonNode model : models) {
                String id = model.path("id").asText();
                result.add(new ModelSummary(
                        id,
                        variant(id),
                        model.path("downloads").asLong(),
                        model.path("likes").asLong(),
                        parameters(model),
                        gated(model),
                        text(model, "createdAt"),
                        text(model, "lastModified")));
            }
            return List.copyOf(result);
        });
    }

    @Override
    public Optional<ModelDetail> getModel(String author, String variant) {
        URI uri = uri("/models/" + encode(author) + "/" + encode(variant), Map.of());
        return cached(uri.toString(), () -> fetch(uri).map(model -> {
            JsonNode card = model.path("cardData");
            List<String> files = new ArrayList<>();
            model.path("siblings").forEach(file -> files.add(file.path("rfilename").asText()));
            List<String> spaces = new ArrayList<>();
            model.path("spaces").forEach(space -> spaces.add(space.asText()));
            return new ModelDetail(
                    model.path("id").asText(),
                    author,
                    variant,
                    text(model, "pipeline_tag"),
                    text(model, "library_name"),
                    text(card, "license"),
                    strings(card.path("base_model")),
                    strings(card.path("language")),
                    model.path("downloads").asLong(),
                    model.path("likes").asLong(),
                    parameters(model),
                    gated(model),
                    text(model, "createdAt"),
                    text(model, "lastModified"),
                    List.copyOf(files),
                    List.copyOf(spaces));
        }));
    }

    @SuppressWarnings("unchecked")
    private <T> T cached(String key, Supplier<T> loader) {
        CacheEntry entry = cache.get(key);
        if (entry != null && entry.expires().isAfter(Instant.now())) {
            return (T) entry.value();
        }
        T value = loader.get();
        cache.put(key, new CacheEntry(Instant.now().plus(config.cacheTtl()), value));
        return value;
    }

    /** The response, or empty if the Hub says the resource isn't there (it answers 401 for unknown models). */
    private Optional<JsonNode> fetch(URI uri) {
        HttpRequest request = HttpRequest.newBuilder(uri)
                .header("Accept", "application/json")
                .header("User-Agent", "qwapp-demo")
                .timeout(Duration.ofSeconds(30))
                .build();
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            int status = response.statusCode();
            if (status == 401 || status == 403 || status == 404) {
                return Optional.empty();
            }
            if (status != 200) {
                throw new WebApplicationException("Hugging Face answered " + status, 502);
            }
            return Optional.of(objectMapper.readTree(response.body()));
        } catch (IOException e) {
            throw new WebApplicationException("Could not read from Hugging Face: " + e.getMessage(), 502);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new WebApplicationException("Interrupted", 502);
        }
    }

    private URI uri(String path, Map<String, List<String>> params) {
        StringBuilder uri = new StringBuilder(config.huggingfaceUrl()).append(path);
        char separator = '?';
        for (Map.Entry<String, List<String>> param : params.entrySet()) {
            for (String value : param.getValue()) {
                uri.append(separator).append(encode(param.getKey())).append('=').append(encode(value));
                separator = '&';
            }
        }
        return URI.create(uri.toString());
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String variant(String id) {
        return id.substring(id.indexOf('/') + 1);
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isTextual() ? value.asText() : null;
    }

    /** Hugging Face has false, or "auto" / "manual" for models needing approval. */
    private static String gated(JsonNode model) {
        return text(model, "gated");
    }

    private static Long parameters(JsonNode model) {
        JsonNode total = model.path("safetensors").path("total");
        return total.isNumber() ? total.asLong() : null;
    }

    /** A card field that is a single string or a list of strings. */
    private static List<String> strings(JsonNode node) {
        List<String> result = new ArrayList<>();
        if (node.isTextual()) {
            result.add(node.asText());
        } else if (node.isArray()) {
            node.forEach(item -> result.add(item.asText()));
        }
        return List.copyOf(result);
    }
}
