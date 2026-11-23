package no.hal.qwapp.llm;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Source of language model data. Implemented by Hugging Face. */
public interface ModelHub {

    /**
     * The text-generation models of {@code author} matching {@code search}, most downloaded first.
     *
     * @param query extra query parameters; a {@code filter} is added to the always applied text-generation task
     */
    List<ModelSummary> listModels(String author, String search, Map<String, List<String>> query);

    /** The model {@code author/variant}, empty if it doesn't exist (or isn't accessible). */
    Optional<ModelDetail> getModel(String author, String variant);
}
