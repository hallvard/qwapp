package no.hal.qwapp.llm;

import jakarta.enterprise.context.ApplicationScoped;

import no.hal.qwapp.api.FrontendContribution;

@ApplicationScoped
public class LlmFrontendContribution implements FrontendContribution {

    @Override
    public String scriptPath() {
        return "/modules/llm/module.js";
    }
}
