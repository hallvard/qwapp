package no.hal.qwapp.frontend;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.Config;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import no.hal.qwapp.api.FrontendContribution;

/**
 * Serves the shell page, injecting an import map for dependencies the shell
 * already bundles (so extension modules don't have to duplicate them) and
 * one script tag per {@link FrontendContribution}.
 */
@Path("/")
@ApplicationScoped
public class FrontendShellResource {

    /** Packages the shell bundles at a stable path; extension modules import these externally. */
    private static final Map<String, String> SHARED_DEPENDENCIES = Map.of(
            "lit", "/assets/shared/lit.js",
            "lit/directives/keyed.js", "/assets/shared/lit-keyed.js");

    @Inject
    Instance<FrontendContribution> contributions;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    Config config;

    @ConfigProperty(name = "qwapp.frontend.shell-template", defaultValue = "META-INF/resources/shell.html")
    String shellTemplatePath;

    @ConfigProperty(name = "qwapp.frontend.path-prefix", defaultValue = "app")
    String frontendPathPrefix;

    @GET
    @Produces(MediaType.TEXT_HTML)
    public String index() {
        return renderShell();
    }

    String renderShell() {
        StringBuilder scriptTags = new StringBuilder();
        for (FrontendContribution contribution : contributions) {
            scriptTags.append("<script type=\"module\" src=\"")
                    .append(contribution.scriptPath())
                    .append("\"></script>\n");
        }

        String importMapTag = "<script type=\"importmap\">"
                + writeImportMap()
                + "</script>\n";

        Map<String, String> metaTagValues = new LinkedHashMap<>();
        populateMetaTagValues(metaTagValues,
            "frontendPathPrefix", browserPrefix()
        );
        String frontendMetaTags = writeMetaTags(metaTagValues);

        return readShellTemplate()
                .replace("<head>", "<head>\n" + importMapTag + frontendMetaTags)
                .replace("</body>", scriptTags + "</body>");
    }

    private static final String META_TAG_PREFIX = "qwapp.frontend.meta-tag.";

    private void populateMetaTagValues(Map<String, String> metaTagValues, String... additionalTagsAndValues) {
        for (int i = 0; i < additionalTagsAndValues.length - 1; i += 2) {
            String key = additionalTagsAndValues[i];
            String value = additionalTagsAndValues[i + 1];
            metaTagValues.put(key, value);
        }
        for (String propertyName : config.getPropertyNames()) {
            if (propertyName.startsWith(META_TAG_PREFIX)) {
              String key = propertyName.substring(META_TAG_PREFIX.length());
              config.getOptionalValue(propertyName, String.class)
                      .ifPresent(value -> metaTagValues.put(key, value));
            }
        }
    }

    private String writeMetaTags(Map<String, String> metaTagValues) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : metaTagValues.entrySet()) {
            builder.append("<meta name=\"env.")
                    .append(escapeHtml(entry.getKey()))
                    .append("\" content=\"")
                    .append(escapeHtml(entry.getValue()))
                    .append("\">\n");
        }
        return builder.toString();
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("\"", "&quot;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

    private String normalizePrefix(String prefix) {
        if (prefix == null) {
            return "";
        }
        String normalized = prefix.strip();
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String browserPrefix() {
        String normalized = normalizePrefix(frontendPathPrefix);
        return normalized.isEmpty() ? "" : "/" + normalized;
    }

    private String writeImportMap() {
        try {
            return objectMapper.writeValueAsString(Map.of("imports", SHARED_DEPENDENCIES));
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String readShellTemplate() {
        try (InputStream in = getClass().getResourceAsStream("/" + shellTemplatePath)) {
            if (in == null) {
                throw new IllegalStateException("Shell template not found on classpath: " + shellTemplatePath);
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
