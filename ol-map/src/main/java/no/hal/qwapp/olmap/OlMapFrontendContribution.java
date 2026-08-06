package no.hal.qwapp.olmap;

import jakarta.enterprise.context.ApplicationScoped;

import no.hal.qwapp.api.FrontendContribution;

@ApplicationScoped
public class OlMapFrontendContribution implements FrontendContribution {

    @Override
    public String scriptPath() {
        return "/modules/ol-map/module.js";
    }
}
