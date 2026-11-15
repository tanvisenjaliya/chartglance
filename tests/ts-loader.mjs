import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
  let targetSpecifier = specifier;
  if (specifier.startsWith("@/")) {
    targetSpecifier = fileURLToPath(new URL("../src/" + specifier.slice(2), import.meta.url));
  }
  try {
    return await nextResolve(targetSpecifier, context);
  } catch (err) {
    if (targetSpecifier.startsWith(".") || targetSpecifier.startsWith("/")) {
      for (const suffix of [".ts", "/index.ts", "/index"]) {
        try {
          return await nextResolve(targetSpecifier + suffix, context);
        } catch {}
      }
    }
    throw err;
  }
}

