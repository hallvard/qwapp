package no.hal.qwapp.api;

/**
 * Describes a module's contribution to the composed frontend shell: a
 * self-registering script to load alongside the shell.
 */
public interface FrontendContribution {

    String scriptPath();
}
