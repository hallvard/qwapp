package no.hal.qwapp.dockshell;

import jakarta.enterprise.context.ApplicationScoped;

import no.hal.qwapp.api.FrontendContribution;

/**
 * Contributes the {@code qwapp-dock-shell} element, an alternative to the
 * default shell. Select it with {@code qwapp.frontend.meta-tag.shell=qwapp-dock-shell}.
 */
@ApplicationScoped
public class DockShellFrontendContribution implements FrontendContribution {

    @Override
    public String scriptPath() {
        return "/modules/dock-shell/module.js";
    }
}
