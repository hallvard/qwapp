package no.hal.qwapp.llm;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;

@QuarkusTest
class FamilyResourceTest {

    /** Stands in for Hugging Face. */
    @Alternative
    @Priority(1)
    @ApplicationScoped
    static class StubHub implements ModelHub {

        @Override
        public List<ModelSummary> listModels(String author, String search, Map<String, List<String>> query) {
            return List.of(new ModelSummary(author + "/" + search + "-8b", search + "-8b", 10, 2, 8_000_000_000L, null, null, null));
        }

        @Override
        public Optional<ModelDetail> getModel(String author, String variant) {
            if (!variant.equals("llama-8b")) {
                return Optional.empty();
            }
            return Optional.of(new ModelDetail(author + "/" + variant, author, variant, "text-generation", null, "mit",
                    List.of(), List.of(), 10, 2, null, "manual", null, null, List.of(), List.of()));
        }
    }

    @Test
    void listsConfiguredFamilies() {
        given().when().get("/api/llm/families")
                .then().statusCode(200)
                .body("name", hasItem("llama"))
                .body("find { it.name == 'llama' }.author", equalTo("meta-llama"))
                .body("find { it.name == 'llama' }.label", equalTo("Llama"));
    }

    @Test
    void listsModelsOfFamily() {
        given().when().get("/api/llm/families/llama")
                .then().statusCode(200)
                .body("author", equalTo("meta-llama"))
                .body("models.variant", contains("llama-8b"));
    }

    @Test
    void getsModelOfFamily() {
        given().when().get("/api/llm/families/llama/llama-8b")
                .then().statusCode(200)
                .body("family", equalTo("llama"))
                .body("model.id", equalTo("meta-llama/llama-8b"))
                .body("model.gated", equalTo("manual"));
    }

    @Test
    void unknownFamilyOrModelIsNotFound() {
        given().when().get("/api/llm/families/nope").then().statusCode(404);
        given().when().get("/api/llm/families/llama/nope").then().statusCode(404);
    }
}
