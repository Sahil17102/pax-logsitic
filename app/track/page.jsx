import sourceHtml from "../../content/track.html?raw";

const bodyMarkup = sourceHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";

export const metadata = {
  title: "Track a Shipment — Pax Logistics",
  description: "Track a Pax Logistics shipment reference.",
};

export default function TrackPage() {
  return <div dangerouslySetInnerHTML={{ __html: bodyMarkup }} />;
}
