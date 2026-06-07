"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/lib/channels.ts
  function extractProvider(contentId) {
    if (!contentId || contentId.length < 2) return null;
    const idUpper = contentId.toUpperCase();
    for (const key of Object.keys(PROVIDER_MAP)) {
      if (idUpper.startsWith(key)) {
        return PROVIDER_MAP[key];
      }
    }
    return null;
  }
  function normalizeChannel(name) {
    return name.toLowerCase().replace(/_/g, " ").replace(/\b(logo|4k|white|hd|b|v2|color)\b/g, "").replace(/\s*-\s*\d+\s*$/, "").replace(/^canal\s+/i, "").replace(/^movistar\s+/i, "m").replace(/\s+/g, "").trim();
  }
  function findBestVariantMatch(providerValue, variantOptions) {
    if (variantOptions.includes(providerValue)) return providerValue;
    const mapped = CHANNEL_TO_PROVIDER[providerValue];
    if (mapped && variantOptions.includes(mapped)) return mapped;
    const lower = providerValue.toLowerCase();
    const ciMatch = variantOptions.find((o) => o.toLowerCase() === lower);
    if (ciMatch) return ciMatch;
    const norm = normalizeChannel(providerValue);
    if (!norm) return null;
    const match = variantOptions.find((o) => normalizeChannel(o) === norm);
    if (match) return match;
    const subMatch = variantOptions.find((o) => {
      const normOpt = normalizeChannel(o);
      return normOpt.length >= 3 && (normOpt.includes(norm) || norm.includes(normOpt));
    });
    return subMatch || null;
  }
  var PROVIDER_MAP, CHANNEL_TO_PROVIDER;
  var init_channels = __esm({
    "src/lib/channels.ts"() {
      "use strict";
      PROVIDER_MAP = {
        PRIME: "Prime Video",
        SKYS: "SkyShowtime",
        DSN: "Disney+",
        MAX: "Max",
        RTVE: "RTVE Play",
        FLMN: "Filmin",
        APREM: "A3 Premium"
      };
      CHANNEL_TO_PROVIDER = {
        // Numeric channel IDs
        "1": "TVE - 1",
        "2": "La 2 - 2",
        // TDT principales
        ANTENA_3: "Antena 3 - 3",
        CUATRO: "Cuatro - 4",
        TELECINCO: "Telecinco - 5",
        LA_SEXTA: "La sexta -6",
        // Canales temáticos con nombre diferente
        XTRM: "xtreme - 17",
        NAT_GEO: "nationalgeographic - 61",
        CLAN: "clanHD - 91",
        CANAL_HOLLYWOOD: "hollywood",
        CANAL_HISTORIA_LOGO: "historia - 60",
        CANAL_COCINA_4K: "Canal Cocina - 68",
        discovery_logo: "discovery - 64",
        ODISEA_4K: "odisea - 63",
        WARNER_TV_B: "warner tv - 13",
        STAR_CHANNEL: "StarChannel",
        VIN_TV: "verditv - 48",
        "24H": "tdp - 103",
        // Deportes — MOVISTAR_ → M
        MOVISTAR_LALIGA: "MLaLiga - 110",
        MOVISTAR_LALIGA_HDR: "MLaLiga - 110",
        MOVISTAR_LALIGA_2: "MLaLiga2 - 112",
        MOVISTAR_LALIGA_2_HDR: "MLaLiga2 - 112",
        MOVISTAR_LALIGA_3: "MLaLiga+ - 122",
        MOVISTAR_LIGA_DE_CAMPEONES: "MLiga de Campeones - 115",
        MOVISTAR_LIGA_DE_CAMPEONES_2: "MLiga de Campeones 2 - 116",
        MOVISTAR_LIGA_DE_CAMPEONES_3: "MLiga de Campeones - 117",
        LALIGA_HYPERMOTION: "MLaLigaHyper - 119",
        LALIGA_HYPERMOTION_2: "MLaLigaHyper 2 - 120",
        LALIGA_INSIDE: "laLigaLiveTvInside",
        DAZN_F1: "DAZNF1",
        DAZN_LALIGA: "DAZN1",
        DAZN_LALIGA_2: "DAZN2",
        DAZN_BALONCESTO: "DAZN3",
        DAZN_BALONCESTO_2: "DAZN4",
        DAZN_MOTOGP: "DAZN Motor",
        PRIMERA_FEDERACION: "TodoFutbol",
        // Runtime → RT (Spanish translations)
        RUNTIME_ACTION_WHITE: "RT_Acci\xF3n - 43",
        RUNTIME_CINE_Y_SERIES_WHITE: "RT_Cine y series - 41",
        RUNTIME_THRILLER_HORROR_WHITE: "RT_Thriller - 42",
        RUNTIME_COMEDY_WHITE: "RT_Comedia - 44",
        RUNTIME_CRIME_WHITE: "RT_Crimen - 45",
        RUNTIME_ROMANCE_WHITE: "RT_Romance - 46",
        RUNTIME_CLASSICS_WHITE: "RT_Cl\xE1sicos - 47",
        RUNTIME_FAMILIA: "enfamilia - 20",
        RUNTIME_SERIES_WHITE: "RT_Cine y series - 41",
        // AMC
        AMC_BREAK: "amcBreak",
        AMC_CRIME: "amcCrime",
        AMC_WESTERN: "amc western",
        AMC_LIVING: "amc living",
        // Eurosport
        EUROSPORT_1_WHITE: "eurosport1",
        EUROSPORT_2_WHITE: "eurosport2",
        // Deportes misc
        RUGBY_SPAIN_WHITE: "rugbySpain",
        TENNIS_CHANNEL: "tennisChannel",
        MY_PADEL_TV: "myPadelTv",
        HORSE_TV: "horseTV",
        NAUTICAL_CHANNEL: "nauticalChannel",
        // Sky
        SKYSHOWTIME_1: "SkyShowtime1"
      };
    }
  });

  // src/code.ts
  var require_code = __commonJS({
    "src/code.ts"() {
      init_channels();
      figma.showUI(__html__, { width: 380, height: 580, themeColors: true });
      var cachedAllCardIds = /* @__PURE__ */ new Set();
      var selectionVersion = 0;
      function isExcluded(node, excludeIds) {
        if (excludeIds.size === 0) return false;
        let current = node;
        while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
          if (excludeIds.has(current.id)) return true;
          current = current.parent;
        }
        return false;
      }
      function isCoverNode(node) {
        return node.name.trim().toLowerCase() === "cover" && "fills" in node;
      }
      function isTitleTreatmentNode(node) {
        const name = node.name.trim().toLowerCase();
        return (name === "titletreatment" || name === "title treatment" || name === "title_treatment") && "fills" in node;
      }
      function findTextNode(parent, name) {
        if (parent.type === "TEXT" && parent.name.trim().toLowerCase() === name) return parent;
        if ("findAllWithCriteria" in parent) {
          const texts = parent.findAllWithCriteria({ types: ["TEXT"] });
          return texts.find((n) => n.name.trim().toLowerCase() === name) || null;
        }
        return null;
      }
      function findAllTextNodes(parent, name) {
        const results = [];
        if (parent.type === "TEXT" && parent.name.trim().toLowerCase() === name) results.push(parent);
        if ("findAllWithCriteria" in parent) {
          const texts = parent.findAllWithCriteria({ types: ["TEXT"] });
          results.push(...texts.filter((n) => n.name.trim().toLowerCase() === name));
        }
        return results;
      }
      function findInstanceNode(parent, name) {
        if (parent.type === "INSTANCE" && parent.name.trim().toLowerCase() === name) return parent;
        if ("findAllWithCriteria" in parent) {
          const instances = parent.findAllWithCriteria({ types: ["INSTANCE"] });
          return instances.find((n) => n.name.trim().toLowerCase() === name) || null;
        }
        return null;
      }
      function applyProviderLogo(logos, providerValue) {
        let applied = 0;
        for (const logo of logos) {
          const props = logo.componentProperties;
          let providerKey = null;
          for (const key of Object.keys(props)) {
            const kl = key.toLowerCase();
            if (kl === "provider" || kl.startsWith("provider#")) {
              providerKey = key;
              break;
            }
          }
          console.log(`[applyProvider] logo="${logo.name}" key="${providerKey}" value="${providerValue}"`);
          if (!providerKey) continue;
          let resolvedValue = providerValue;
          const mainComp = logo.mainComponent;
          const compSet = mainComp == null ? void 0 : mainComp.parent;
          if (compSet && compSet.type === "COMPONENT_SET") {
            const baseKey = providerKey.split("#")[0];
            const propDef = compSet.componentPropertyDefinitions[baseKey];
            if ((propDef == null ? void 0 : propDef.type) === "VARIANT" && propDef.variantOptions) {
              resolvedValue = findBestVariantMatch(providerValue, propDef.variantOptions);
              if (!resolvedValue) {
                console.warn(`[provider] No match for "${providerValue}"`);
                continue;
              }
            }
          }
          try {
            if (mainComp) logo.swapComponent(mainComp);
            logo.setProperties({ [providerKey]: resolvedValue });
            applied++;
          } catch (e) {
            try {
              logo.setProperties({ [providerKey]: resolvedValue });
              applied++;
            } catch (_) {
            }
          }
        }
        return applied;
      }
      function isProviderLogoComponent(node) {
        if (node.type !== "INSTANCE") return false;
        const name = node.name.trim().toLowerCase();
        if (name === "providerlogosquare" || name === "providerlogorectangle") return true;
        try {
          const props = node.componentProperties;
          return Object.keys(props).some((k) => {
            const kl = k.toLowerCase();
            return kl === "provider" || kl.startsWith("provider#");
          });
        } catch (_) {
          return false;
        }
      }
      function findNearestInstanceAncestor(node) {
        let current = node.parent;
        while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
          if (current.type === "INSTANCE") return current;
          current = current.parent;
        }
        return null;
      }
      function findProviderLogoAncestor(node) {
        let current = node.parent;
        while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
          if (current.type === "INSTANCE") {
            try {
              const props = current.componentProperties;
              if (Object.keys(props).some((k) => {
                const kl = k.toLowerCase();
                return kl === "provider" || kl.startsWith("provider#");
              })) {
                return current;
              }
            } catch (_) {
            }
          }
          current = current.parent;
        }
        return null;
      }
      function findProviderLogoNodes(nodes, excludeIds = /* @__PURE__ */ new Set()) {
        const logos = [];
        for (const node of nodes) {
          if (isExcluded(node, excludeIds)) continue;
          if (isProviderLogoComponent(node)) logos.push(node);
          if ("findAllWithCriteria" in node) {
            const instances = node.findAllWithCriteria({ types: ["INSTANCE"] });
            for (const child of instances) {
              if (isProviderLogoComponent(child) && !isExcluded(child, excludeIds)) {
                logos.push(child);
              }
            }
          }
        }
        return logos;
      }
      async function getComponentNameAsync(inst) {
        var _a;
        if ((_a = inst.mainComponent) == null ? void 0 : _a.name) return inst.mainComponent.name.toLowerCase();
        try {
          const main = await inst.getMainComponentAsync();
          if (main == null ? void 0 : main.name) return main.name.toLowerCase();
        } catch (_) {
        }
        return "";
      }
      function isCardComponentName(name) {
        const n = name.toLowerCase();
        return n.includes("card") && (n.includes("portrait") || n.includes("landscape") || n.includes("reparto") || n.includes("chapter"));
      }
      function refreshCardCacheSync(nodes) {
        var _a, _b;
        for (const node of nodes) {
          if (node.type === "INSTANCE") {
            const compName = (((_a = node.mainComponent) == null ? void 0 : _a.name) || "").toLowerCase();
            if (isCardComponentName(compName)) cachedAllCardIds.add(node.id);
          }
          if ("findAllWithCriteria" in node) {
            const instances = node.findAllWithCriteria({ types: ["INSTANCE"] });
            for (const child of instances) {
              const compName = (((_b = child.mainComponent) == null ? void 0 : _b.name) || "").toLowerCase();
              if (isCardComponentName(compName)) cachedAllCardIds.add(child.id);
            }
          }
        }
      }
      var CARD_CACHE_BATCH_SIZE = 10;
      async function refreshCardCache(nodes) {
        cachedAllCardIds = /* @__PURE__ */ new Set();
        refreshCardCacheSync(nodes);
        const instances = [];
        for (const node of nodes) {
          if (node.type === "INSTANCE" && !cachedAllCardIds.has(node.id)) {
            instances.push(node);
          }
          if ("findAllWithCriteria" in node) {
            const children = node.findAllWithCriteria({ types: ["INSTANCE"] });
            for (const child of children) {
              if (!cachedAllCardIds.has(child.id)) {
                instances.push(child);
              }
            }
          }
        }
        for (let i = 0; i < instances.length; i += CARD_CACHE_BATCH_SIZE) {
          const batch = instances.slice(i, i + CARD_CACHE_BATCH_SIZE);
          const names = await Promise.all(batch.map((inst) => getComponentNameAsync(inst)));
          for (let j = 0; j < batch.length; j++) {
            if (isCardComponentName(names[j])) cachedAllCardIds.add(batch[j].id);
          }
        }
      }
      function findCoverNodes(nodes, excludeIds = /* @__PURE__ */ new Set()) {
        const covers = [];
        for (const node of nodes) {
          if (isExcluded(node, excludeIds)) continue;
          if (isCoverNode(node)) covers.push(node);
          if ("findAll" in node) {
            const children = node.findAll((child) => isCoverNode(child) && !isExcluded(child, excludeIds));
            covers.push(...children);
          }
        }
        return covers;
      }
      function findTitleTreatmentNodes(nodes, excludeIds = /* @__PURE__ */ new Set()) {
        const titleTreatments = [];
        for (const node of nodes) {
          if (isExcluded(node, excludeIds)) continue;
          if (isTitleTreatmentNode(node)) titleTreatments.push(node);
          if ("findAll" in node) {
            const children = node.findAll((child) => isTitleTreatmentNode(child) && !isExcluded(child, excludeIds));
            titleTreatments.push(...children);
          }
        }
        return titleTreatments;
      }
      function isChapterCardComponent(name) {
        const n = name.toLowerCase();
        return n.includes("card") && n.includes("chapter");
      }
      function hasCoverChild(node) {
        if (isCoverNode(node)) return true;
        if ("findOne" in node) {
          return !!node.findOne((child) => isCoverNode(child));
        }
        return false;
      }
      async function findChapterCardInstancesAsync(nodes) {
        var _a, _b, _c;
        const chapterCards = [];
        const allInstances = [];
        for (const node of nodes) {
          if (node.type === "INSTANCE" && !allInstances.includes(node)) {
            allInstances.push(node);
          }
          if ("findAllWithCriteria" in node) {
            const instances = node.findAllWithCriteria({ types: ["INSTANCE"] });
            for (const inst of instances) {
              if (!allInstances.includes(inst)) allInstances.push(inst);
            }
          }
        }
        const addedIds = /* @__PURE__ */ new Set();
        for (const inst of allInstances) {
          if (addedIds.has(inst.id)) continue;
          const instanceName = inst.name;
          const syncName = ((_a = inst.mainComponent) == null ? void 0 : _a.name) || "";
          let isChapter = false;
          if (isChapterCardComponent(instanceName)) {
            isChapter = true;
          } else if (syncName && isChapterCardComponent(syncName)) {
            isChapter = true;
          } else if (((_c = (_b = inst.mainComponent) == null ? void 0 : _b.parent) == null ? void 0 : _c.type) === "COMPONENT_SET") {
            const componentSetName = inst.mainComponent.parent.name;
            if (isChapterCardComponent(componentSetName)) {
              isChapter = true;
            }
          } else if (!syncName) {
            const asyncName = await getComponentNameAsync(inst);
            if (isChapterCardComponent(asyncName)) {
              isChapter = true;
            }
          }
          if (isChapter && hasCoverChild(inst)) {
            chapterCards.push(inst);
            addedIds.add(inst.id);
          }
        }
        return chapterCards;
      }
      async function setTextContent(parent, name, value) {
        const textNode = findTextNode(parent, name);
        if (textNode) {
          const segments = textNode.getStyledTextSegments(["fontName"]);
          if (segments.length > 0) {
            for (const segment of segments) {
              await figma.loadFontAsync(segment.fontName);
            }
          } else {
            const fn = textNode.fontName;
            if (fn !== figma.mixed) {
              await figma.loadFontAsync(fn);
            }
          }
          textNode.characters = value;
        }
      }
      function isPersonMetadata(m) {
        return "personName" in m;
      }
      async function fillMetadata(nodes, metadata) {
        for (const node of nodes) {
          if (isPersonMetadata(metadata)) {
            if (metadata.personName) await setTextContent(node, "name", metadata.personName);
            const rolNode = findTextNode(node, "rol");
            if (rolNode) {
              if (metadata.isActor) {
                rolNode.visible = false;
              } else {
                rolNode.visible = true;
                if (metadata.rol) {
                  for (const segment of rolNode.getStyledTextSegments(["fontName"])) {
                    await figma.loadFontAsync(segment.fontName);
                  }
                  rolNode.characters = metadata.rol;
                }
              }
            }
          } else {
            const fields = [
              { name: "title", value: metadata.title },
              { name: "rating", value: metadata.rating },
              { name: "year", value: metadata.year },
              { name: "duration", value: metadata.duration },
              { name: "sinopsis", value: metadata.sinopsis },
              { name: "schedule", value: metadata.schedule },
              { name: "live", value: metadata.live }
            ];
            for (const field of fields) {
              if (field.value) await setTextContent(node, field.name, field.value);
            }
            if (metadata.genres && metadata.genres.length > 0) {
              const genreNames = ["genre", "genre2", "genre3"];
              for (let i = 0; i < genreNames.length; i++) {
                const genreNode = findTextNode(node, genreNames[i]);
                if (i < metadata.genres.length) {
                  if (genreNode) {
                    await setTextContent(node, genreNames[i], metadata.genres[i]);
                    genreNode.visible = true;
                  }
                } else {
                  if (genreNode) genreNode.visible = false;
                }
              }
              const allSeparators = findAllTextNodes(node, "separator");
              const numGenres = metadata.genres.length;
              for (let i = 0; i < allSeparators.length; i++) {
                allSeparators[i].visible = i < numGenres - 1;
              }
            }
            if (metadata.ageRating) {
              const ageTag = findInstanceNode(node, "agetag");
              if (ageTag) {
                const visibilityStates = [];
                let currentNode = ageTag;
                while (currentNode && "visible" in currentNode) {
                  const sceneNode = currentNode;
                  visibilityStates.push({ node: sceneNode, wasVisible: sceneNode.visible });
                  if (!sceneNode.visible) sceneNode.visible = true;
                  currentNode = sceneNode.parent;
                  if (currentNode === node) break;
                }
                const props = ageTag.componentProperties;
                let ratingKey = null;
                for (const key of Object.keys(props)) {
                  if (key === "rating" || key.startsWith("rating#")) {
                    ratingKey = key;
                    break;
                  }
                }
                if (ratingKey) {
                  try {
                    const mainComponent = ageTag.mainComponent;
                    if (mainComponent) ageTag.swapComponent(mainComponent);
                    ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                  } catch (e) {
                    try {
                      ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                    } catch (_) {
                    }
                  }
                }
                for (let i = visibilityStates.length - 1; i >= 0; i--) {
                  const { node: stateNode, wasVisible } = visibilityStates[i];
                  if (!wasVisible) stateNode.visible = false;
                }
              }
            }
          }
        }
      }
      var METADATA_NODE_NAMES = /* @__PURE__ */ new Set(["title", "rating", "year", "duration", "sinopsis", "genre", "name", "rol", "chapter"]);
      function findMetadataScope(coverNode) {
        let fallback = null;
        let current = coverNode.parent;
        while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
          const sceneNode = current;
          if ("findAllWithCriteria" in sceneNode) {
            const texts = sceneNode.findAllWithCriteria({ types: ["TEXT"] });
            if (texts.length > 0) {
              if (!fallback) fallback = sceneNode;
              const hasMetadataNode = texts.some((t) => METADATA_NODE_NAMES.has(t.name.trim().toLowerCase()));
              if (hasMetadataNode) return sceneNode;
            }
          }
          current = sceneNode.parent;
        }
        return fallback || coverNode.parent || coverNode;
      }
      function typeFromName(name) {
        const n = name.toLowerCase();
        if (n.includes("card") && n.includes("portrait")) return "card-portrait";
        if (n.includes("card") && n.includes("landscape")) return "card-landscape";
        if (n.includes("card") && n.includes("chapter")) return "card-chapters";
        if (n.includes("slideshow")) return "slideshow";
        if (n.includes("vps")) return "vps";
        return "unknown";
      }
      function detectTypeSync(nodes) {
        var _a;
        let componentType = "unknown";
        let found = false;
        for (const node of nodes) {
          const t = typeFromName(node.name);
          if (t !== "unknown") return t;
          if (node.type === "INSTANCE") {
            const compName = (((_a = node.mainComponent) == null ? void 0 : _a.name) || "").toLowerCase();
            const t2 = typeFromName(compName);
            if (t2 !== "unknown") return t2;
          }
          if ("findOne" in node) {
            node.findOne((child) => {
              var _a2;
              const ct = typeFromName(child.name);
              if (ct !== "unknown") {
                componentType = ct;
                found = true;
                return true;
              }
              if (child.type === "INSTANCE") {
                const compName = (((_a2 = child.mainComponent) == null ? void 0 : _a2.name) || "").toLowerCase();
                const ct2 = typeFromName(compName);
                if (ct2 !== "unknown") {
                  componentType = ct2;
                  found = true;
                  return true;
                }
              }
              return false;
            });
          }
          if (found) break;
        }
        return componentType;
      }
      async function sendSelection() {
        const myVersion = ++selectionVersion;
        const selection = figma.currentPage.selection;
        let componentType = detectTypeSync(selection);
        if (componentType === "unknown") {
          const allInstances = [];
          for (const node of selection) {
            if (node.type === "INSTANCE") allInstances.push(node);
            if ("findAllWithCriteria" in node) {
              allInstances.push(...node.findAllWithCriteria({ types: ["INSTANCE"] }));
            }
          }
          for (const inst of allInstances) {
            const compName = await getComponentNameAsync(inst);
            if (myVersion !== selectionVersion) return;
            const t = typeFromName(compName);
            if (t !== "unknown") {
              componentType = t;
              break;
            }
          }
        }
        if (myVersion !== selectionVersion) return;
        if (componentType === "vps") {
          await refreshCardCache(selection);
          if (myVersion !== selectionVersion) return;
        } else {
          cachedAllCardIds = /* @__PURE__ */ new Set();
        }
        const coverCount = findCoverNodes(selection, cachedAllCardIds).length;
        const titleTreatmentCount = findTitleTreatmentNodes(selection, cachedAllCardIds).length;
        const chapterInstances = await findChapterCardInstancesAsync(selection);
        if (myVersion !== selectionVersion) return;
        const chapterCardCount = chapterInstances.length;
        figma.ui.postMessage({ type: "selection-info", count: selection.length, coverCount, titleTreatmentCount, componentType, chapterCardCount });
      }
      var selectionTimer = null;
      function debouncedSendSelection() {
        if (selectionTimer) clearTimeout(selectionTimer);
        selectionTimer = setTimeout(() => {
          selectionTimer = null;
          sendSelection();
        }, 120);
      }
      figma.on("selectionchange", () => {
        figma.ui.postMessage({ type: "selection-changed" });
        debouncedSendSelection();
      });
      figma.ui.onmessage = async (msg) => {
        var _a, _b, _c, _d;
        if (msg.type === "get-selection") {
          sendSelection();
        }
        if (msg.type === "notify-warning" && msg.message) {
          figma.notify(msg.message, { timeout: 3e3 });
        }
        if (msg.type === "save-api-key" && msg.apiKey) {
          await figma.clientStorage.setAsync("tmdb_api_key", msg.apiKey);
        }
        if (msg.type === "load-api-key") {
          const storedKey = await figma.clientStorage.getAsync("tmdb_api_key");
          figma.ui.postMessage({ type: "loaded-api-key", apiKey: storedKey || "" });
        }
        if (msg.type === "cache-catalog") {
          try {
            const catalogData = msg.data;
            const cacheEntry = {
              data: catalogData,
              timestamp: Date.now()
            };
            await figma.clientStorage.setAsync("otv_catalog_cache", cacheEntry);
            console.log("Catalog cached successfully");
          } catch (e) {
            console.error("Error caching catalog:", e);
          }
        }
        if (msg.type === "get-cached-catalog") {
          try {
            const cacheEntry = await figma.clientStorage.getAsync("otv_catalog_cache");
            if (cacheEntry) {
              figma.ui.postMessage({
                type: "cached-catalog",
                data: cacheEntry.data,
                timestamp: cacheEntry.timestamp
              });
            } else {
              figma.ui.postMessage({
                type: "cached-catalog",
                data: null
              });
            }
          } catch (e) {
            console.error("Error loading cached catalog:", e);
            figma.ui.postMessage({
              type: "cached-catalog",
              data: null
            });
          }
        }
        if (msg.type === "apply-cover" && msg.imageBytes) {
          const bytes = new Uint8Array(msg.imageBytes);
          const image = figma.createImage(bytes);
          const selection = figma.currentPage.selection;
          const coverNodes = findCoverNodes(selection, cachedAllCardIds);
          if (coverNodes.length === 0) {
            figma.notify('\u26A0\uFE0F No se encontr\xF3 ning\xFAn frame llamado "cover" en la selecci\xF3n.', { error: true });
            return;
          }
          for (const cover of coverNodes) {
            if ("fills" in cover) {
              cover.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
            }
          }
          if (msg.titleTreatmentBytes) {
            const ttBytes = new Uint8Array(msg.titleTreatmentBytes);
            const ttImage = figma.createImage(ttBytes);
            const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
            for (const ttNode of ttNodes) {
              if ("fills" in ttNode) {
                ttNode.fills = [{ type: "IMAGE", imageHash: ttImage.hash, scaleMode: "FIT" }];
              }
            }
          }
          if (msg.metadata) {
            const scopesDone = /* @__PURE__ */ new Set();
            for (const cover of coverNodes) {
              const scope = findMetadataScope(cover);
              if (!scopesDone.has(scope.id)) {
                scopesDone.add(scope.id);
                await fillMetadata([scope], msg.metadata);
              }
            }
          }
          const ttCount = msg.titleTreatmentBytes ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
          figma.notify(ttCount > 0 ? `\u2705 Cover y t\xEDtulo aplicados a ${coverNodes.length} elemento(s).` : `\u2705 Cover aplicada a ${coverNodes.length} elemento(s).`);
        }
        if (msg.type === "apply-cover-url" && msg.coverUrl) {
          const selection = figma.currentPage.selection;
          const coverUrl = msg.coverUrl;
          if (detectTypeSync(selection) === "vps") refreshCardCacheSync(selection);
          const coverNodes = findCoverNodes(selection, cachedAllCardIds);
          if (coverNodes.length === 0) {
            figma.notify('\u26A0\uFE0F No se encontr\xF3 ning\xFAn frame llamado "cover" en la selecci\xF3n.', { error: true });
            figma.ui.postMessage({ type: "apply-done", success: false });
            return;
          }
          let image;
          try {
            if (msg.imageBytes) {
              image = figma.createImage(new Uint8Array(msg.imageBytes));
            } else {
              image = await figma.createImageAsync(coverUrl);
            }
          } catch (e) {
            figma.notify("\u26A0\uFE0F Error al cargar la imagen.", { error: true });
            figma.ui.postMessage({ type: "apply-done", success: false, error: e.message });
            return;
          }
          for (const cover of coverNodes) {
            if ("fills" in cover) {
              cover.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
            }
          }
          if (msg.titleTreatmentUrl) {
            try {
              const ttImage = await figma.createImageAsync(msg.titleTreatmentUrl);
              const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
              for (const ttNode of ttNodes) {
                if ("fills" in ttNode) {
                  ttNode.fills = [{ type: "IMAGE", imageHash: ttImage.hash, scaleMode: "FIT" }];
                }
              }
            } catch (_) {
            }
          }
          if (msg.metadata) {
            try {
              const scopesDone = /* @__PURE__ */ new Set();
              for (const cover of coverNodes) {
                const scope = findMetadataScope(cover);
                if (!scopesDone.has(scope.id)) {
                  scopesDone.add(scope.id);
                  await fillMetadata([scope], msg.metadata);
                }
              }
            } catch (_) {
            }
          }
          try {
            let providerLogos = findProviderLogoNodes(selection, cachedAllCardIds);
            if (providerLogos.length === 0) {
              for (const cn of coverNodes) {
                const pa = findProviderLogoAncestor(cn);
                if (pa) {
                  providerLogos = [pa];
                  break;
                }
              }
            }
            if (providerLogos.length > 0) {
              const channelName = (_a = msg.metadata) == null ? void 0 : _a.channelName;
              const providerFromId = ((_b = msg.metadata) == null ? void 0 : _b.contentId) ? extractProvider(msg.metadata.contentId) : null;
              const providerValue = channelName || providerFromId;
              if (providerValue) applyProviderLogo(providerLogos, providerValue);
            }
          } catch (_) {
          }
          const ttCount = msg.titleTreatmentUrl ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
          figma.notify(ttCount > 0 ? `\u2705 Cover y t\xEDtulo aplicados a ${coverNodes.length} elemento(s).` : `\u2705 Cover aplicada a ${coverNodes.length} elemento(s).`);
          figma.ui.postMessage({ type: "apply-done", success: true });
        }
        function getChannelRowOffset(nodes) {
          for (const node of nodes) {
            const n = node.name.trim().toLowerCase().replace(/[\s_-]+/g, "");
            if (n.includes("row") && n.includes("channel")) return 3;
          }
          return 0;
        }
        if (msg.type === "apply-multiple-covers-url" && msg.coversUrlData) {
          const selection = figma.currentPage.selection;
          const coverNodes = findCoverNodes(selection, cachedAllCardIds);
          if (coverNodes.length === 0) {
            figma.notify('\u26A0\uFE0F No se encontr\xF3 ning\xFAn frame llamado "cover" en la selecci\xF3n.', { error: true });
            figma.ui.postMessage({ type: "apply-done", success: false });
            return;
          }
          const coversUrlData = msg.coversUrlData;
          const cardOffset = getChannelRowOffset(selection);
          const targetCoverNodes = coverNodes.slice(cardOffset);
          const applyCount = Math.min(targetCoverNodes.length, coversUrlData.length);
          let successCount = 0;
          for (let i = 0; i < applyCount; i++) {
            const coverNode = targetCoverNodes[i];
            const coverData = coversUrlData[i];
            try {
              const image = coverData.imageBytes ? figma.createImage(new Uint8Array(coverData.imageBytes)) : await figma.createImageAsync(coverData.coverUrl);
              if ("fills" in coverNode) {
                coverNode.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
              }
              successCount++;
            } catch (e) {
              console.warn(`[cover ${i}] Image failed: ${coverData.coverUrl.substring(0, 100)}`);
            }
            if (coverData.titleTreatmentUrl) {
              try {
                const ttImage = await figma.createImageAsync(coverData.titleTreatmentUrl);
                const scope = findMetadataScope(coverNode);
                const ttNodes = findTitleTreatmentNodes([scope]);
                if (ttNodes.length > 0 && "fills" in ttNodes[0]) {
                  ttNodes[0].fills = [{ type: "IMAGE", imageHash: ttImage.hash, scaleMode: "FIT" }];
                }
              } catch (_) {
              }
            }
            if (coverData.metadata) {
              const scope = findMetadataScope(coverNode);
              await fillMetadata([scope], coverData.metadata);
            }
            const scope2 = findMetadataScope(coverNode);
            let logos = findProviderLogoNodes([scope2], cachedAllCardIds);
            console.log(`[provider S1] cover="${coverNode.name}" scope="${scope2.name}" logos=${logos.length}`);
            if (logos.length === 0) {
              const instAncestor = findNearestInstanceAncestor(coverNode);
              console.log(`[provider S2] ancestor="${(_c = instAncestor == null ? void 0 : instAncestor.name) != null ? _c : "null"}"`);
              if (instAncestor) logos = findProviderLogoNodes([instAncestor], cachedAllCardIds);
              console.log(`[provider S2] logos=${logos.length}`);
            }
            if (logos.length === 0) {
              const providerAncestor = findProviderLogoAncestor(coverNode);
              console.log(`[provider S3] providerAncestor="${(_d = providerAncestor == null ? void 0 : providerAncestor.name) != null ? _d : "null"}"`);
              if (providerAncestor) logos = [providerAncestor];
            }
            const metaRaw = coverData.metadata;
            const channelName = metaRaw == null ? void 0 : metaRaw.channelName;
            const providerFromId = (metaRaw == null ? void 0 : metaRaw.contentId) ? extractProvider(metaRaw.contentId) : null;
            const providerValue = channelName || providerFromId;
            console.log(`[provider] channelName="${channelName}" providerValue="${providerValue}" logos=${logos.length}`);
            if (logos.length > 0 && providerValue) {
              applyProviderLogo(logos, providerValue);
            }
          }
          if (msg.carouselTitle) {
            for (const node of selection) {
              let applied = false;
              if (node.type === "INSTANCE") {
                const props = node.componentProperties;
                for (const [key, prop] of Object.entries(props)) {
                  if (prop.type === "TEXT") {
                    const baseName = key.split("#")[0].trim().toLowerCase();
                    if (baseName.includes("row")) {
                      try {
                        node.setProperties({ [key]: msg.carouselTitle });
                        applied = true;
                      } catch (_) {
                      }
                      break;
                    }
                  }
                }
              }
              if (!applied) {
                try {
                  await setTextContent(node, "row_title", msg.carouselTitle);
                } catch (_) {
                }
              }
            }
          }
          const skipped = applyCount - successCount;
          if (skipped > 0) {
            figma.notify(`\u2705 ${successCount} cover(s) aplicadas. \u26A0\uFE0F ${skipped} no disponibles.`);
          } else {
            figma.notify(`\u2705 ${successCount} cover(s) aplicadas.`);
          }
          figma.ui.postMessage({ type: "apply-done", success: true });
        }
        if (msg.type === "apply-multiple-covers" && msg.coversData) {
          const selection = figma.currentPage.selection;
          const coverNodes = findCoverNodes(selection, cachedAllCardIds);
          if (coverNodes.length === 0) {
            figma.notify('\u26A0\uFE0F No se encontr\xF3 ning\xFAn frame llamado "cover" en la selecci\xF3n.', { error: true });
            return;
          }
          const coversData = msg.coversData;
          const applyCount = Math.min(coverNodes.length, coversData.length);
          for (let i = 0; i < applyCount; i++) {
            const coverNode = coverNodes[i];
            const coverData = coversData[i];
            const bytes = new Uint8Array(coverData.imageBytes);
            const image = figma.createImage(bytes);
            if ("fills" in coverNode) {
              coverNode.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
            }
            if (coverData.titleTreatmentBytes) {
              const ttBytes = new Uint8Array(coverData.titleTreatmentBytes);
              const ttImage = figma.createImage(ttBytes);
              const scope = findMetadataScope(coverNode);
              const ttNodes = findTitleTreatmentNodes([scope]);
              if (ttNodes.length > 0 && "fills" in ttNodes[0]) {
                ttNodes[0].fills = [{ type: "IMAGE", imageHash: ttImage.hash, scaleMode: "FIT" }];
              }
            }
            if (coverData.metadata) {
              const scope = findMetadataScope(coverNode);
              await fillMetadata([scope], coverData.metadata);
            }
          }
          figma.notify(`\u2705 ${applyCount} cover(s) aplicadas con contenido aleatorio.`);
        }
        if (msg.type === "apply-episode-covers" && msg.episodesData) {
          const selection = figma.currentPage.selection;
          const episodesData = msg.episodesData;
          const chapterInstances = await findChapterCardInstancesAsync(selection);
          if (chapterInstances.length === 0) {
            figma.notify("\u26A0\uFE0F No se encontraron componentes card_chapters en la selecci\xF3n.", { error: true });
            figma.ui.postMessage({ type: "apply-done", success: false });
            return;
          }
          const applyCount = Math.min(chapterInstances.length, episodesData.length);
          try {
            for (let i = 0; i < applyCount; i++) {
              const chapterCard = chapterInstances[i];
              const epData = episodesData[i];
              let coverNode = null;
              if (isCoverNode(chapterCard)) {
                coverNode = chapterCard;
              } else if ("findOne" in chapterCard) {
                coverNode = chapterCard.findOne((child) => isCoverNode(child));
              }
              if (!coverNode) continue;
              if (epData.coverUrl) {
                const image = await figma.createImageAsync(epData.coverUrl);
                if ("fills" in coverNode) {
                  coverNode.fills = [
                    { type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }
                  ];
                }
              }
              if (epData.metadata) {
                const fields = [
                  { name: "title", value: epData.metadata.title },
                  { name: "chapter", value: epData.metadata.chapter },
                  { name: "duration", value: epData.metadata.duration },
                  { name: "sinopsis", value: epData.metadata.sinopsis }
                ];
                for (const field of fields) {
                  if (field.value) await setTextContent(chapterCard, field.name, field.value);
                }
              }
            }
            figma.notify(`\u2705 ${applyCount} cap\xEDtulo(s) aplicado(s).`);
            figma.ui.postMessage({ type: "apply-done", success: true });
          } catch (e) {
            figma.notify("\u26A0\uFE0F Error al aplicar cap\xEDtulos.", { error: true });
            figma.ui.postMessage({ type: "apply-done", success: false, error: e.message });
          }
        }
        if (msg.type === "close") {
          figma.closePlugin();
        }
      };
      sendSelection();
      (async () => {
        const storedKey = await figma.clientStorage.getAsync("tmdb_api_key");
        if (storedKey) {
          figma.ui.postMessage({ type: "loaded-api-key", apiKey: storedKey });
        }
      })();
    }
  });
  require_code();
})();
