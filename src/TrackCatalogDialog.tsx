import CatalogDialog from "./CatalogDialog";
import type { Catalog, TrackPlacement } from "../shared";
import CatalogPicker from "./CatalogPicker";
export default function TrackCatalogDialog({
  catalog,
  track,
  onPick,
  onClose,
}: {
  catalog: Catalog;
  track: TrackPlacement;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <CatalogDialog title="Выберите профиль трека" onClose={onClose}>
      <CatalogPicker
        items={catalog.tracks}
        resource="tracks"
        label="Треки"
        category={(item) =>
          item.mount === "surface" ? "Накладные" : "Встроенные"
        }
        description={(item) => item.description}
        selectedId={track.productId}
        disabledReason={(item) =>
          item.layoutIds.includes(track.layoutId)
            ? null
            : "Профиль не поддерживает выбранную форму"
        }
        actionLabel="Выбрать"
        onPick={(item) => onPick(item.id)}
      />
    </CatalogDialog>
  );
}
