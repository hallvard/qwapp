package no.hal.qwapp.frontend;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Serves the shell for browser navigations under the configured frontend
 * path prefix before JAX-RS routing, so non-frontend paths like /q are
 * left to other Quarkus handlers.
 */
@Provider
@PreMatching
@ApplicationScoped
public class FrontendPrefixRequestFilter implements ContainerRequestFilter {

    @Inject
    FrontendShellResource shellResource;

    @ConfigProperty(name = "qwapp.frontend.path-prefix", defaultValue = "app")
    String frontendPathPrefix;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        if (!"GET".equalsIgnoreCase(requestContext.getMethod())) {
            return;
        }

        String accept = requestContext.getHeaderString(HttpHeaders.ACCEPT);
        if (!acceptsHtml(accept)) {
            return;
        }

        String path = normalizePath(requestContext.getUriInfo().getPath());
        String normalizedPrefix = normalizePrefix(frontendPathPrefix);
        if (!matchesFrontendPrefix(path, normalizedPrefix)) {
            return;
        }
        // A dot suggests a file, unless the client explicitly asked for HTML, as browsers do
        // when navigating: view ids can contain dots (e.g. a model named Llama-3.1-8B).
        if (path.contains(".") && !accept.contains("text/html")) {
            return;
        }

        requestContext.abortWith(Response.ok(shellResource.renderShell(), MediaType.TEXT_HTML_TYPE).build());
    }

    private boolean acceptsHtml(String acceptHeader) {
        if (acceptHeader == null || acceptHeader.isBlank()) {
            return false;
        }
        return acceptHeader.contains("text/html") || acceptHeader.contains("*/*");
    }

    private boolean matchesFrontendPrefix(String path, String normalizedPrefix) {
        if (normalizedPrefix.isEmpty()) {
            return false;
        }
        return path.equals(normalizedPrefix) || path.startsWith(normalizedPrefix + "/");
    }

    private String normalizePath(String path) {
        if (path == null) {
            return "";
        }
        String normalized = path.strip();
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
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
}
