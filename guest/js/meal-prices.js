/* Prix des repas, en euros. Changez les nombres ici.
   Pour l’autre grille, commentez MEAL_PRICES et décommentez le bloc suivant.
   Dîner de l’autre grille = déjeuner + 5.
   earlyBreakfast : forfait par table, pas par personne, si l’heure est avant `before`. */
var MEAL_PRICES = {
  breakfast: 10,
  lunch: { poulet: 15, viande: 15, vegetarien: 15 },
  dinner: { poulet: 20, viande: 20, vegetarien: 20 },
  earlyBreakfast: { supplementEur: 10, before: "09:00" }
};

/*
var MEAL_PRICES = {
  breakfast: 12,
  lunch: { poulet: 16, viande: 19, vegetarien: 15 },
  dinner: { poulet: 21, viande: 24, vegetarien: 20 },
  earlyBreakfast: { supplementEur: 10, before: "09:00" }
};
*/
