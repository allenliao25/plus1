export function isMissingColumnError(error: { code?: string; message?: string } | null, column: string) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    (message.includes(column.toLowerCase()) && message.includes("column"))
  );
}

export function isMissingRpcError(error: { code?: string; message?: string } | null, rpcName: string) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "PGRST202" ||
    (message.includes(rpcName.toLowerCase()) &&
      (message.includes("function") || message.includes("schema cache")))
  );
}

export function isMissingRelationError(
  error: { code?: string; message?: string } | null,
  relationName: string,
) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  const relation = relationName.toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (message.includes(relation) &&
      (message.includes("relation") || message.includes("schema cache")))
  );
}
