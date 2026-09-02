/** RSC seed와 Client Query가 공유하는 ability cache identity다. */
export const authAbilityQueryKeys = {
  ability: { queryKey: ["auth", "ability"] as const },
};
