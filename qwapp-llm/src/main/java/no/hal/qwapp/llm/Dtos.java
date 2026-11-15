package no.hal.qwapp.llm;

import java.util.List;

/** Response types of {@link FamilyResource}. */
public final class Dtos {

    private Dtos() {
    }

    public record FamilySummary(String name, String label, String author) {
    }

    public record FamilyModels(String name, String label, String author, List<ModelSummary> models) {
    }

    public record FamilyModel(String family, String familyLabel, ModelDetail model) {
    }
}
