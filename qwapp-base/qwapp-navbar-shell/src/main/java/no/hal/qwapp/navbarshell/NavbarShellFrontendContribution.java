package no.hal.qwapp.navbarshell;

import jakarta.enterprise.context.ApplicationScoped;

import no.hal.qwapp.api.FrontendContribution;

/**
 * Contributes the nav bar shell, which shows one view at a time. It is used
 * when this module is on the classpath (instead of, for example, qwapp-dock-shell).
 */
@ApplicationScoped
public class NavbarShellFrontendContribution implements FrontendContribution {

    @Override
    public String scriptPath() {
        return "/modules/navbar-shell/module.js";
    }
}
