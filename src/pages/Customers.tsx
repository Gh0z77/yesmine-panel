import { useQuery } from "@tanstack/react-query";

import { Card, Empty, uzs } from "@/components/ui";
import { customers, ordersQuery } from "@/lib/queries";

export default function Customers() {
  const { data: orders = [], isLoading } = useQuery(ordersQuery);
  if (isLoading) return <Empty text="Yuklanmoqda…" />;

  const rows = customers(orders);
  const repeat = rows.filter((r) => r.orders > 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Mijozlar</h1>
        <p className="mt-1 text-sm text-muted">
          {rows.length} ta mijoz · {repeat.length} tasi qayta xarid qilgan
        </p>
      </div>

      {rows.length === 0 ? (
        <Empty text="Hali mijoz yo'q." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="pb-3">Mijoz</th>
                  <th className="pb-3">Telefon</th>
                  <th className="pb-3 text-right">Buyurtma</th>
                  <th className="pb-3 text-right">Jami xarid</th>
                  <th className="pb-3 text-right">Oxirgi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.phone} className="border-t border-line">
                    <td className="py-3">
                      {c.name}
                      {c.orders > 1 ? (
                        <span className="ml-2 rounded-full bg-pink-blush/40 px-2 py-0.5 text-xs text-rose-deep">
                          doimiy
                        </span>
                      ) : null}
                    </td>
                    <td className="py-3 text-muted">{c.phone}</td>
                    <td className="py-3 text-right tabular-nums">{c.orders}</td>
                    <td className="py-3 text-right tabular-nums">{uzs(c.spent)}</td>
                    <td className="py-3 text-right text-muted">
                      {new Date(c.last).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
