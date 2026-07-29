import sourceHtml from "../../content/estimate.html?raw";

const bodyMarkup = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

export const metadata = {
  title: "Shipping Estimate — Pax Logistics",
  description: "Get an indicative Pax Logistics shipping estimate.",
};

export default function EstimatePage() {
  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
