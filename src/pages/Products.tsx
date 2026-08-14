import { useQuery } from "@tanstack/react-query";

import { BarList, Card, Empty, short, uzs } from "@/components/ui";
import { orderItemsQuery, ordersQuery, productsQuery, topProducts } from "@/lib/queries";

export default function Products() {
  const { data: orders = [] } = useQuery(ordersQuery);
  const { data: items = [], isLoading } = useQuery(orderItemsQuery);
  const { data: catalogue = [] } = useQuery(productsQuery);

  if (isLoading) return <Empty text="Yuklanmoqda…" />;

  const sold = topProducts(orders, items, 100);
  const soldNames = new Set(sold.map((s) => s.name));
  const lowStock = catalogue.filter((p) => p.active && p.stock <= 3);
  const never = catalogue.filter((p) => p.active && !soldNames.has(p.name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Mahsulotlar</h1>
        <p className="mt-1 text-sm text-muted">
          Katalogda {catalogue.length} ta · sotilgani {sold.length} xil
        </p>
      </div>

      {lowStock.length > 0 ? (
        <Card title="Ombor tugayapti" hint="3 donadan kam qolgan">
          <BarList
            rows={lowStock.map((p) => ({
              label: p.name,
              value: p.stock,
              color: "oklch(0.65 0.2 30)",
            }))}
            format={(n) => `${n} dona`}
          />
        </Card>
      ) : null}

      <Card title="Sotuv bo'yicha reyting">
        {sold.length === 0 ? (
          <Empty text="Hali sotuv yo'q." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-3">Mahsulot</th>
                  <th className="pb-3 text-right">Dona</th>
                  <th className="pb-3 text-right">Tushum</th>
                  <th className="pb-3 text-right">Qoldiq</th>
                </tr>
              </thead>
              <tbody>
                {sold.map((s) => {
                  const p = catalogue.find((c) => c.name === s.name);
                  return (
                    <tr key={s.name} className="border-t border-line">
                      <td className="py-3">{s.name}</td>
                      <td className="py-3 text-right tabular-nums">{s.units}</td>
                      <td className="py-3 text-right tabular-nums">{uzs(s.revenue)}</td>
                      <td className="py-3 text-right tabular-nums text-muted">
                        {p ? p.stock : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {never.length > 0 ? (
        <Card
          title="Hali bir marta ham sotilmagan"
          hint="Rasm, narx yoki tavsifni ko'rib chiqing"
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {never.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 text-sm">
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-muted">{short(Number(p.price))}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
