import PlaylistAddIcon from "@mui/icons-material/PlaylistAdd";
import { Autocomplete, Box, Button, TextField, Typography } from "@mui/material";
import { fetchComplectRpd } from "@pages/rpd-complect/api/api";
import type { TemplateData } from "@pages/rpd-complect/types";
import { axiosBase } from "@shared/api";
import { useStore } from "@shared/hooks";
import {
  showErrorMessage,
  showSuccessMessage,
  showWarningMessage,
} from "@shared/lib";
import { Loader } from "@shared/ui";
import { FC, useEffect, useMemo, useState } from "react";

type PreviousDisciplineOption = TemplateData & {
  label: string; // "Дисциплина (семестр N)"
};

const PreviousDisciplinesSelect: FC = () => {
  const jsonData = useStore((state) => state.jsonData);
  const updateJsonData = useStore((state) => state.updateJsonData);
  const templateId = useStore((state) => state.jsonData.id);
  const currentPlaceMoreText = useStore(
    (state) => state.jsonData.place_more_text
  ) as string | undefined;

  const complectId = jsonData.id_rpd_complect as number | undefined;
  const currentSemester = Number(jsonData.semester);
  const currentDiscipline = jsonData.disciplins_name as string | undefined;

  const [allDisciplines, setAllDisciplines] = useState<TemplateData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<PreviousDisciplineOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!complectId) return;
      setIsLoading(true);
      try {
        const complect = await fetchComplectRpd(String(complectId));
        if (!cancelled) setAllDisciplines(complect.templates ?? []);
      } catch (error) {
        console.error("Ошибка загрузки дисциплин комплекта:", error);
        showErrorMessage("Не удалось загрузить список дисциплин");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [complectId]);

  const previousOptions = useMemo<PreviousDisciplineOption[]>(() => {
    if (!Number.isFinite(currentSemester)) return [];

    return allDisciplines
      .filter((d) => {
        if (!d.discipline) return false;
        if (currentDiscipline && d.discipline === currentDiscipline) return false;
        const sem = Number(d.semester);
        return Number.isFinite(sem) && sem < currentSemester;
      })
      .map((d) => ({
        ...d,
        label: `${d.discipline} (семестр ${d.semester})`,
      }))
      .sort((a, b) => a.semester - b.semester || a.discipline.localeCompare(b.discipline));
  }, [allDisciplines, currentSemester, currentDiscipline]);


  const getExistingDisciplineNames = (html: string | undefined): string[] => {
    if (!html) return [];
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      return Array.from(doc.querySelectorAll("li"))
        .map((li) => li.textContent?.trim().replace(/[.;]\s*$/, "") ?? "")
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  const handleApply = async () => {
    if (!templateId || !selected.length) return;

    const existingHtml = currentPlaceMoreText ?? "";
    const existingNames = getExistingDisciplineNames(existingHtml);
    const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
    const toAdd = selected
      .filter((d) => !existingSet.has(d.discipline.trim().toLowerCase()))
      .map((d) => d.discipline.trim());

    if (!toAdd.length) {
      showWarningMessage("Выбранные дисциплины уже есть в списке");
      setSelected([]);
      return;
    }

    const finalList = [...existingNames, ...toAdd];

    const listItemsHtml = finalList
      .map((name, i) => {
        const suffix = i === finalList.length - 1 ? "." : ";";
        return `<li>${name}${suffix}</li>`;
      })
      .join("");

    let resultHtml: string;
    if (/<ul[^>]*>[\s\S]*<\/ul>/i.test(existingHtml)) {
      resultHtml = existingHtml.replace(
        /<ul[^>]*>[\s\S]*?<\/ul>/i,
        `<ul>${listItemsHtml}</ul>`
      );
    } else {
      resultHtml = `${existingHtml}<ul>${listItemsHtml}</ul>`;
    }

    setIsSaving(true);
    try {
      await axiosBase.put(`update-json-value/${templateId}`, {
        fieldToUpdate: "place_more_text",
        value: resultHtml,
      });
      updateJsonData("place_more_text", resultHtml);
      const skipped = selected.length - toAdd.length;
      if (skipped > 0) {
        showSuccessMessage(
          `Добавлено дисциплин: ${toAdd.length}. Уже было в списке: ${skipped}`
        );
      } else {
        showSuccessMessage(`Добавлено дисциплин: ${toAdd.length}`);
      }
      setSelected([]);
    } catch (error) {
      console.error(error);
      showErrorMessage("Ошибка при сохранении дисциплин");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ py: 1 }}>
        <Loader />
      </Box>
    );
  }

  if (!previousOptions.length) {
    return (
      <Box sx={{ my: 2 }}>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Нет предшествующих дисциплин для выбора.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ my: 2 }}>
      <Typography sx={{ fontSize: "15px", fontWeight: 600, py: 1 }}>
        Дисциплины, предшествующие данной
      </Typography>
      <Autocomplete
        multiple
        disableCloseOnSelect
        filterSelectedOptions
        options={previousOptions}
        getOptionLabel={(option) => option.label}
        value={selected}
        onChange={(_, value) => setSelected(value as PreviousDisciplineOption[])}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Поиск дисциплины"
            placeholder="Выберите дисциплины"
            size="small"
          />
        )}
      />
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          variant="outlined"
          endIcon={<PlaylistAddIcon color="primary" />}
          onClick={handleApply}
          disabled={!selected.length || isSaving}
        >
          Добавить выбранные дисциплины
        </Button>
      </Box>
    </Box>
  );
};


export default PreviousDisciplinesSelect;
