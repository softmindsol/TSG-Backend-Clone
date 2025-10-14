export const replacePlaceholders = (text, data) => {
  let result = text;
  for (const key in data) {
    const regex = new RegExp(`{${key}}`, "g");
    result = result.replace(regex, data[key] || "");
  }
  return result;
};
