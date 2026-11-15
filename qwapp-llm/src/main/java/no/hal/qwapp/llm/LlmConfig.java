package no.hal.qwapp.llm;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import io.smallrye.config.ConfigMapping;
import io.smallrye.config.WithDefault;

/** Configuration of the language model families, see META-INF/microprofile-config.properties. */
@ConfigMapping(prefix = "qwapp.llm")
public interface LlmConfig {

    /** The families, by name. */
    Map<String, Family> families();

    @WithDefault("https://huggingface.co/api")
    String huggingfaceUrl();

    @WithDefault("PT10M")
    Duration cacheTtl();

    interface Family {

        /** The Hugging Face author (organization) publishing the family's models. */
        String author();

        /** Search term selecting the family's models among the author's. */
        String search();

        Optional<String> label();

        /** Extra Hugging Face query parameters, e.g. to limit the size of the family. */
        Map<String, List<String>> query();
    }
}
