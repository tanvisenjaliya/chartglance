export async function resolve(specifier, context, nextResolve) {
  let targetSpecifier = specifier;
  if (specifier.startsWith("@/")) {
    targetSpecifier = "/Users/tanvisenjaliya/Documents/chartglance/src/" + specifier.slice(2);
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

