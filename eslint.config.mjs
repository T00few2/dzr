import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  { ignores: ["apps/**", "node_modules/**", ".next/**"] },
  ...nextVitals,
  {
    rules: {
      // The React 19 hooks plugin flags existing data-loading effects. Those effects
      // were accepted by next lint; rewriting them is outside this upgrade.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default eslintConfig;
