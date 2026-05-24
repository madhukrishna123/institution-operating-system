type FieldConfig = {
  key: string;
  label: string;
  type: string;
  visible: boolean;
  required: boolean;
};

type ConfigurableListViewProps = {
  fields: FieldConfig[];
  records: Record<string, string | number | boolean | null>[];
  canEdit?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
  onEdit?: (record: Record<string, string | number | boolean | null>) => void;
  onDelete?: (record: Record<string, string | number | boolean | null>) => void;
};

export function ConfigurableListView({
  fields,
  records,
  canEdit = false,
  canDelete = false,
  emptyMessage = "No records yet. Create the first one when you are ready.",
  onEdit,
  onDelete
}: ConfigurableListViewProps) {
  const hasActions = canEdit || canDelete;

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/75 bg-white/70 shadow-sm backdrop-blur">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-[#f8efe3]/80 text-slate-600">
            <tr>
              {fields.map((field) => (
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em]" key={field.key}>
                  {field.label}
                </th>
              ))}
              {hasActions ? <th className="px-4 py-3 text-xs font-bold uppercase tracking-[0.12em]">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-slate-500" colSpan={fields.length + (hasActions ? 1 : 0)}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.map((record) => (
                <tr className="border-t border-[#eadcc9] transition hover:bg-white/65" key={String(record.id)}>
                  {fields.map((field) => (
                    <td className="px-4 py-3 text-slate-800" key={field.key}>
                      {String(record[field.key] ?? "")}
                    </td>
                  ))}
                  {hasActions ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <button
                            className="rounded-full border border-[#d9b980] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#70470f] hover:bg-white"
                            onClick={() => onEdit?.(record)}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            className="rounded-full border border-red-200 bg-white/60 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                            onClick={() => onDelete?.(record)}
                          >
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
