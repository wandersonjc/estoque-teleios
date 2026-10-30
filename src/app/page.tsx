import { redirect } from "next/navigation";

// A página inicial leva direto para a lista de produtos,
// que é o primeiro item do Módulo 1 (Estoque).
export default function Home() {
  redirect("/produtos");
}
