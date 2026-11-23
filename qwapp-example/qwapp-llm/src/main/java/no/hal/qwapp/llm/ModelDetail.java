package no.hal.qwapp.llm;

import java.util.List;

/** A single model. {@code gated} is null unless access to the model needs approval. */
public record ModelDetail(
        String id,
        String author,
        String variant,
        String task,
        String library,
        String license,
        List<String> baseModels,
        List<String> languages,
        long downloads,
        long likes,
        Long parameters,
        String gated,
        String createdAt,
        String lastModified,
        List<String> files,
        List<String> spaces) {
}
