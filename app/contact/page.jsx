import sourceHtml from "../../content/contact.html?raw";

const bodyMarkup = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

export const metadata = {
  title: "Contact — Pax Logistics",
  description: "Contact Pax Logistics in Himayat Nagar, Hyderabad.",
};

export default function ContactPage() {
  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
