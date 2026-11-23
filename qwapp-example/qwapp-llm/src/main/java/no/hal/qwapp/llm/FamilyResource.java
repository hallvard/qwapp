package no.hal.qwapp.llm;

import java.util.List;
import java.util.TreeMap;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import no.hal.qwapp.llm.Dtos.FamilyModel;
import no.hal.qwapp.llm.Dtos.FamilyModels;
import no.hal.qwapp.llm.Dtos.FamilySummary;

/** The configured language model families, and their models. */
@Path("/api/llm/families")
@Produces(MediaType.APPLICATION_JSON)
@ApplicationScoped
public class FamilyResource {

    @Inject
    LlmConfig config;

    @Inject
    ModelHub hub;

    @GET
    public List<FamilySummary> families() {
        return new TreeMap<>(config.families()).entrySet().stream()
                .map(entry -> summary(entry.getKey(), entry.getValue()))
                .toList();
    }

    @GET
    @Path("{name}")
    public FamilyModels family(@PathParam("name") String name) {
        LlmConfig.Family family = findFamily(name);
        FamilySummary summary = summary(name, family);
        return new FamilyModels(name, summary.label(), family.author(),
                hub.listModels(family.author(), family.search(), family.query()));
    }

    /** Only models of the family's author can be reached, so this doesn't proxy arbitrary models. */
    @GET
    @Path("{name}/{variant}")
    public FamilyModel model(@PathParam("name") String name, @PathParam("variant") String variant) {
        LlmConfig.Family family = findFamily(name);
        ModelDetail model = hub.getModel(family.author(), variant)
                .orElseThrow(() -> new NotFoundException("No model " + variant + " in family " + name));
        return new FamilyModel(name, summary(name, family).label(), model);
    }

    private LlmConfig.Family findFamily(String name) {
        LlmConfig.Family family = config.families().get(name);
        if (family == null) {
            throw new NotFoundException("No family " + name);
        }
        return family;
    }

    private static FamilySummary summary(String name, LlmConfig.Family family) {
        return new FamilySummary(name, family.label().orElse(name), family.author());
    }
}
