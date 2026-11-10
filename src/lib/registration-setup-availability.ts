/**
 * Deliberately fail closed until password updates can be ordered safely against
 * deactivation, revocation and independent bans. This is not an environment
 * flag: enabling requires a reviewed implementation and hosted acceptance.
 */
export const registrationPasswordSetupAvailable = false;
