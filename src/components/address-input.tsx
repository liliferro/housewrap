"use client";
import { useEffect, useId, useRef, useState } from "react";
import { addressChoiceSchema, type AddressChoice } from "@/lib/address";
export function AddressInput() {
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<AddressChoice[]>([]),
    [selected, setSelected] = useState<AddressChoice | null>(null),
    [manual, setManual] = useState(false),
    [message, setMessage] = useState(""),
    [active, setActive] = useState(-1);
  useEffect(() => {
    input.current?.setCustomValidity(
      selected || manual
        ? ""
        : "Selecciona una dirección de las sugerencias del mapa.",
    );
  }, [selected, manual, query]);
  useEffect(() => {
    if (query.trim().length < 5 || selected || manual) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setMessage("Buscando direcciones…");
      try {
        const response = await fetch(
          `/api/addresses?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok)
          throw new Error(body.error || "No se pudo consultar el mapa.");
        const choices = addressChoiceSchema.array().parse(body.results);
        setResults(choices);
        setActive(-1);
        setMessage(
          choices.length
            ? "Selecciona la dirección correcta."
            : "No encontramos una dirección completa. Añade número, calle, ciudad o código postal.",
        );
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setMessage(
            err instanceof Error
              ? err.message
              : "No se pudo consultar el mapa.",
          );
        }
      }
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected, manual]);
  function choose(choice: AddressChoice) {
    setQuery(choice.label);
    setSelected(choice);
    setResults([]);
    setActive(-1);
    setMessage(
      "Dirección seleccionada del mapa. Revisa que corresponda a la obra.",
    );
    input.current?.focus();
  }
  return (
    <div className="address-search">
      <label htmlFor={id}>Dirección de la obra</label>
      <input
        ref={input}
        id={id}
        name="address"
        required
        minLength={5}
        maxLength={200}
        autoComplete="off"
        placeholder="Número, calle, ciudad o código postal"
        value={query}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={results.length > 0}
        aria-controls={`${id}-results`}
        aria-activedescendant={
          active >= 0 ? `${id}-option-${active}` : undefined
        }
        aria-describedby={`${id}-help`}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setResults([]);
          setActive(-1);
          setMessage("");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && results.length) {
            e.preventDefault();
            setActive((active + 1) % results.length);
          } else if (e.key === "ArrowUp" && results.length) {
            e.preventDefault();
            setActive((active + results.length - 1) % results.length);
          } else if (e.key === "Enter" && active >= 0 && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape" && results.length) {
            e.preventDefault();
            e.stopPropagation();
            setResults([]);
          }
        }}
      />
      {!!results.length && (
        <ul
          id={`${id}-results`}
          role="listbox"
          aria-label="Direcciones sugeridas"
        >
          {results.map((r, i) => (
            <li key={r.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={active === i}
                id={`${id}-option-${i}`}
                tabIndex={-1}
                onClick={() => choose(r)}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-help`} className="small muted" role="status">
        {message ||
          "Escribe al menos 5 caracteres. Busca direcciones de Estados Unidos."}
      </p>
      {selected && (
        <a
          className="text-link"
          href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=18/${selected.lat}/${selected.lon}`}
          target="_blank"
          rel="noreferrer"
        >
          Ver ubicación en el mapa ↗
        </a>
      )}
      <input
        type="hidden"
        name="address_choice"
        value={selected ? JSON.stringify(selected) : ""}
      />
      <label className="address-manual">
        <input
          type="checkbox"
          name="address_manual"
          checked={manual}
          onChange={(e) => {
            setManual(e.target.checked);
            setSelected(null);
            setResults([]);
            setMessage("");
          }}
        />
        La dirección no aparece: guardar pendiente de verificar
      </label>
      {manual && (
        <label>
          Motivo de dirección pendiente
          <textarea
            name="address_review_note"
            required
            minLength={10}
            maxLength={500}
            placeholder="Por ejemplo: obra nueva, confirmar lote y ubicación con el builder."
          />
        </label>
      )}
      <p className="small muted">
        Búsqueda:{" "}
        <a href="https://photon.komoot.io" target="_blank" rel="noreferrer">
          Photon
        </a>{" "}
        · Datos ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        . Coincidencia en mapa, no validación postal.
      </p>
    </div>
  );
}
