package no.hal.qwapp.settings;

import jakarta.enterprise.context.ApplicationScoped;

import no.hal.qwapp.api.FrontendContribution;

@ApplicationScoped
public class SettingsFrontendContribution implements FrontendContribution {

    @Override
    public String scriptPath() {
        return "/modules/settings/module.js";
    }
}
