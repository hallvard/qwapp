package no.hal.qwapp.llm;

/** A model in a family listing. {@code gated} is null unless access to the model needs approval. */
public record ModelSummary(
        String id,
        String variant,
        long downloads,
        long likes,
        Long parameters,
        String gated,
        String createdAt,
        String lastModified) {
}
