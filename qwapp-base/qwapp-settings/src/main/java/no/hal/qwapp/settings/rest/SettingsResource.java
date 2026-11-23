package no.hal.qwapp.settings.rest;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/settings")
@ApplicationScoped
public class SettingsResource {

    private final Map<String, String> settings = new ConcurrentHashMap<>(Map.of(
            "theme", "light",
            "locale", "nb-NO"));

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> get() {
        return Map.copyOf(settings);
    }

    @GET
    @Path("{key}")
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> getOne(@PathParam("key") String key) {
        String value = settings.get(key);
        if (value == null) {
            throw new NotFoundException("No setting " + key);
        }
        return Map.of("key", key, "value", value);
    }

    @PUT
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> update(Map<String, String> updates) {
        settings.putAll(updates);
        return Map.copyOf(settings);
    }
}
