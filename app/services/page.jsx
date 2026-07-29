import sourceHtml from "../../content/services.html?raw";

const bodyMarkup = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

export const metadata = {
  title: "Services — Pax Logistics",
  description: "Courier, domestic shipping, business dispatch and freight support from Pax Logistics.",
};

export default function ServicesPage() {
  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
