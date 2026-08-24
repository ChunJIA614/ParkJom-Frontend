import { useEffect, useState, type ChangeEvent } from 'react';
import type { VehicleCatalogEntry } from '../api/vehicleCatalogApi';

const CUSTOM_VALUE = '__custom__';

interface VehicleBrandModelFieldsProps {
  brand: string;
  model: string;
  catalog: VehicleCatalogEntry[];
  disabled?: boolean;
  onBrandChange: (value: string) => void;
  onModelChange: (value: string) => void;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export default function VehicleBrandModelFields({
  brand,
  model,
  catalog,
  disabled = false,
  onBrandChange,
  onModelChange,
}: VehicleBrandModelFieldsProps) {
  const [customBrandMode, setCustomBrandMode] = useState(false);
  const [customModelMode, setCustomModelMode] = useState(false);
  const selectedEntry = catalog.find((entry) => normalize(entry.brand) === normalize(brand));
  const selectedBrandValue = selectedEntry?.brand ?? (customBrandMode || brand ? CUSTOM_VALUE : '');
  const modelOptions = selectedEntry?.models ?? [];
  const selectedModelValue = modelOptions.some((option) => normalize(option) === normalize(model))
    ? modelOptions.find((option) => normalize(option) === normalize(model)) ?? model
    : (customModelMode || model ? CUSTOM_VALUE : '');

  useEffect(() => {
    if (selectedEntry) setCustomBrandMode(false);
  }, [brand, selectedEntry]);

  useEffect(() => {
    if (selectedEntry && modelOptions.some((option) => normalize(option) === normalize(model))) {
      setCustomModelMode(false);
    }
  }, [model, modelOptions, selectedEntry]);

  const handleBrandSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const isCustom = value === CUSTOM_VALUE;
    setCustomBrandMode(isCustom);
    setCustomModelMode(false);
    onBrandChange(isCustom ? '' : value);
    onModelChange('');
  };

  const handleModelSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    const isCustom = value === CUSTOM_VALUE;
    setCustomModelMode(isCustom);
    onModelChange(isCustom ? '' : value);
  };

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Brand</span>
        <select
          value={selectedBrandValue}
          onChange={handleBrandSelect}
          required={!brand && !customBrandMode}
          disabled={disabled}
          aria-label="Vehicle brand"
          className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-[12px] focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Select brand</option>
          {catalog.map((entry) => (
            <option key={entry.brand} value={entry.brand}>{entry.brand}</option>
          ))}
          <option value={CUSTOM_VALUE}>Other / enter manually</option>
        </select>
        {selectedBrandValue === CUSTOM_VALUE && (
          <input
            type="text"
            value={brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="Enter brand"
            maxLength={50}
            required
            disabled={disabled}
            aria-label="Custom vehicle brand"
            className="w-full rounded-xl border border-[#dadce0] px-3 py-2 text-[12px] focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        )}
      </label>
      <label className="block space-y-1">
        <span className="text-[10px] font-semibold uppercase text-[#5f6368]">Model</span>
        {modelOptions.length > 0 && selectedBrandValue !== CUSTOM_VALUE ? (
          <select
            value={selectedModelValue}
            onChange={handleModelSelect}
            required={!model && !customModelMode}
            disabled={disabled || !brand}
            aria-label="Vehicle model"
            className="w-full rounded-xl border border-[#dadce0] bg-white px-3 py-2 text-[12px] focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select model</option>
            {modelOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value={CUSTOM_VALUE}>Other / enter manually</option>
          </select>
        ) : null}
        {(selectedBrandValue === CUSTOM_VALUE || modelOptions.length === 0 || selectedModelValue === CUSTOM_VALUE) && (
          <input
            type="text"
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            placeholder="Enter model"
            maxLength={50}
            required
            disabled={disabled || !brand}
            aria-label="Custom vehicle model"
            className="w-full rounded-xl border border-[#dadce0] px-3 py-2 text-[12px] focus:border-[#007AFF] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
        )}
        {!brand && (
          <p className="text-[10px] text-[#80868b]">Select a brand first.</p>
        )}
      </label>
    </div>
  );
}
