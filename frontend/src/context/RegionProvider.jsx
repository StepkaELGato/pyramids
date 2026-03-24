import { useEffect, useMemo, useState } from "react";
import { RegionContext } from "./region-context.js";
import { clubs as clubsApi } from "../api/index.js";

const LS_CITY_KEY = "pyramids_selected_city";

export function RegionProvider({ children }) {
  const [selectedCity, setSelectedCity] = useState(() => {
    const saved = localStorage.getItem(LS_CITY_KEY);
    return saved || "Москва";
  });

  const [cities, setCities] = useState([]);
  const [clubsInCity, setClubsInCity] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState(null);

  useEffect(() => {
    localStorage.setItem(LS_CITY_KEY, selectedCity);
  }, [selectedCity]);

  useEffect(() => {
    let alive = true;

    async function loadCities() {
      try {
        const data = await clubsApi.cities();
        if (!alive) return;

        const list = Array.isArray(data?.items) ? data.items : [];
        setCities(list);

        if (list.length && !list.includes(selectedCity)) {
          setSelectedCity(list[0]);
        }
      } catch (e) {
        console.warn("Failed to load cities:", e);
      }
    }

    loadCities();

    return () => {
      alive = false;
    };
  }, [selectedCity]);

  useEffect(() => {
    let alive = true;

    async function loadClubs() {
      try {
        const data = await clubsApi.list({ city: selectedCity });
        if (!alive) return;

        const items = Array.isArray(data?.items) ? data.items : [];
        setClubsInCity(items);

        if (items.length) {
          const ids = items.map((x) => x.id);
          if (!selectedClubId || !ids.includes(selectedClubId)) {
            setSelectedClubId(items[0].id);
          }
        } else {
          setSelectedClubId(null);
        }
      } catch (e) {
        if (!alive) return;
        console.warn("Failed to load clubs:", e);
        setClubsInCity([]);
        setSelectedClubId(null);
      }
    }

    loadClubs();

    return () => {
      alive = false;
    };
  }, [selectedCity]);

  const value = useMemo(
    () => ({
      cities,
      selectedCity,
      setSelectedCity,
      clubsInCity,
      selectedClubId,
      setSelectedClubId,
    }),
    [cities, selectedCity, clubsInCity, selectedClubId]
  );

  return (
    <RegionContext.Provider value={value}>
      {children}
    </RegionContext.Provider>
  );
}