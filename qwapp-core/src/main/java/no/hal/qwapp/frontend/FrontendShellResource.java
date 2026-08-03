package no.hal.qwapp.frontend;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
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
            "lit", "/assets/shared/lit.js");

    @Inject
    Instance<FrontendContribution> contributions;

    @Inject
    ObjectMapper objectMapper;

    @GET
    @Produces(MediaType.TEXT_HTML)
    public String index() {
        StringBuilder scriptTags = new StringBuilder();
        for (FrontendContribution contribution : contributions) {
            scriptTags.append("<script type=\"module\" src=\"")
                    .append(contribution.scriptPath())
                    .append("\"></script>\n");
        }

        String importMapTag = "<script type=\"importmap\">"
                + writeImportMap()
                + "</script>\n";

        return readShellTemplate()
                .replace("<head>", "<head>\n" + importMapTag)
                .replace("</body>", scriptTags + "</body>");
    }

    private String writeImportMap() {
        try {
            return objectMapper.writeValueAsString(Map.of("imports", SHARED_DEPENDENCIES));
        } catch (JsonProcessingException e) {
            throw new UncheckedIOException(e);
        }
    }

    private String readShellTemplate() {
        try (InputStream in = getClass().getResourceAsStream("/META-INF/resources/shell.html")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
