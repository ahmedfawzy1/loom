// The editor's names for the fields a translation carries, keyed by the API's field names
export const TRANSLATED_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  summary: "Summary",
  updateNote: "Update note",
  body: "Body",
  faq: "FAQ",
  seoMetaTitle: "Meta title",
  seoMetaDescription: "Meta description",
  jobTitle: "Job title",
  bio: "Bio",
  buttonLabel: "Button label",
};

export const fieldLabel = (name: string) =>
  TRANSLATED_FIELD_LABELS[name] ?? name;
