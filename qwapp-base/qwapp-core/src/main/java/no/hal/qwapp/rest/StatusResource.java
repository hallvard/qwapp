package no.hal.qwapp.rest;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

@Path("/api/status")
public class StatusResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Status status() {
        return new Status("qwapp-core");
    }

    public record Status(String module) {
    }
}
