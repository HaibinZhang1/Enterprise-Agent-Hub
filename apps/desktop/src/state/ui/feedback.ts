export interface FlashMessage {
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  body: string;
}
