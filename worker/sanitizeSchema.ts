import { defaultSchema } from "rehype-sanitize";

export const sanitizeSchema = (() => {
  const tagNames = new Set<string>(defaultSchema.tagNames || []);
  tagNames.delete("img");

  return {
    ...defaultSchema,
    tagNames: Array.from(tagNames),
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes?.code || []),
        ["className", /^language-[\w-]+$/]
      ],
      a: [
        ...(defaultSchema.attributes?.a || []),
        ["href", true],
        ["title", true]
      ]
    }
  };
})();
