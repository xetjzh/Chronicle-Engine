import { Character, WorldEvent, ProjectData, LocationNode } from '../types';

export class SimulationEngine {
  /**
   * Advances the world simulation time by steps.
   * Runs:
   * 1. Perception & Environmental update
   * 2. Character Utility & Decision making
   * 3. Action execution & State transitions
   * 4. Structured causality-linked event emission
   * 5. Epistemic fact propagation (characters only learn facts from events they witnessed or heard about)
   */
  public static stepTime(
    project: ProjectData,
    stepHours: number = 4
  ): { updatedProject: ProjectData; newEvents: WorldEvent[] } {
    const characters = JSON.parse(JSON.stringify(project.characters)) as Character[];
    const locations = project.locations;
    const existingEvents = [...project.events];
    const newEvents: WorldEvent[] = [];

    const nextTimeStepIndex = project.timeStepIndex + 1;
    const nextTimeStr = this.calculateNextTimeString(project.currentSimulationTime, stepHours);

    // Group alive characters by location
    const aliveChars = characters.filter(c => c.isAlive);
    const locMap = new Map<string, Character[]>();
    aliveChars.forEach(c => {
      const list = locMap.get(c.currentLocationId) || [];
      list.push(c);
      locMap.set(c.currentLocationId, list);
    });

    // Check co-located encounters
    locMap.forEach((charsInLoc, locId) => {
      const location = locations.find(l => l.id === locId);
      if (!location) return;

      if (charsInLoc.length >= 2) {
        // High probability of dialogue/confrontation/trade
        const charA = charsInLoc[0];
        const charB = charsInLoc[1];
        
        const encounterEvent = this.generateSocialEncounter(
          charA,
          charB,
          location,
          nextTimeStr,
          nextTimeStepIndex,
          existingEvents
        );

        if (encounterEvent) {
          newEvents.push(encounterEvent);
          existingEvents.push(encounterEvent);
          this.propagateFactsFromEvent(encounterEvent, [charA, charB]);
        }
      } else if (charsInLoc.length === 1) {
        // Solo autonomous behavior: search, travel or rest
        const solo = charsInLoc[0];
        const soloEvent = this.generateSoloAction(
          solo,
          location,
          locations,
          nextTimeStr,
          nextTimeStepIndex,
          existingEvents
        );
        if (soloEvent) {
          newEvents.push(soloEvent);
          existingEvents.push(soloEvent);
          this.propagateFactsFromEvent(soloEvent, [solo]);
        }
      }
    });

    const updatedProject: ProjectData = {
      ...project,
      currentSimulationTime: nextTimeStr,
      timeStepIndex: nextTimeStepIndex,
      characters: characters,
      events: [...existingEvents]
    };

    return { updatedProject, newEvents };
  }

  private static calculateNextTimeString(currentTime: string, addHours: number): string {
    const hourTokens = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    const currentToken = hourTokens.find(t => currentTime.includes(t)) || '戌时';
    const currIdx = hourTokens.indexOf(currentToken);
    const steps = Math.floor(addHours / 2) || 1;
    const nextIdx = (currIdx + steps) % hourTokens.length;
    const basePrefix = currentTime.split(' ')[0] || '天元七年·霜降第十二日';
    
    // Day rollover if index loops
    if (currIdx + steps >= hourTokens.length) {
      return `${basePrefix}(次日) ${hourTokens[nextIdx]}`;
    }
    return `${basePrefix} ${hourTokens[nextIdx]}`;
  }

  private static generateSocialEncounter(
    a: Character,
    b: Character,
    loc: LocationNode,
    timeStr: string,
    stepIdx: number,
    history: WorldEvent[]
  ): WorldEvent | null {
    const relAtoB = a.relationships[b.id] || '漠然';
    const relBtoA = b.relationships[a.id] || '漠然';
    const lastEvent = history[history.length - 1];
    const causes = lastEvent ? [lastEvent.id] : [];

    // Determine nature of interaction based on personality, mood & relationship
    if (relAtoB === '怀疑' || relBtoA === '戒备') {
      a.currentMood = '警惕';
      b.currentMood = '警惕';
      return {
        id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'encounter',
        locationId: loc.id,
        participantIds: [a.id, b.id],
        causeEventIds: causes,
        title: `${a.name} 与 ${b.name} 在${loc.name}试探交锋`,
        description: `${b.name}借故靠近${a.name}盘问来历，双方皆未拔兵刃，但言语锋芒毕露，暗中揣测对方随身行李中的秘辛。`,
        consequences: [`双方戒备加深`, `${a.name}隐藏了行囊特征`],
        stateChanges: [
          { characterId: a.id, field: 'currentMood', oldValue: a.currentMood, newValue: '警惕' },
          { characterId: b.id, field: 'currentMood', oldValue: b.currentMood, newValue: '警惕' }
        ],
        visibility: {
          isPublic: false,
          knownByCharacterIds: [a.id, b.id]
        },
        confirmed: true
      };
    } else if (relAtoB === '照顾' || relAtoB === '旧识') {
      return {
        id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'dialogue',
        locationId: loc.id,
        participantIds: [a.id, b.id],
        causeEventIds: causes,
        title: `${a.name} 私下向 ${b.name} 传递风声`,
        description: `在${loc.name}背人处，${a.name}低声提点${b.name}关内风声收紧，并暗中赠予其保命热汤与碎散银两。`,
        consequences: [`${b.name}获得情报与微量财物`, `双方互信增进`],
        stateChanges: [
          { characterId: b.id, field: 'wealth', oldValue: b.wealth, newValue: b.wealth + 2 }
        ],
        visibility: {
          isPublic: false,
          knownByCharacterIds: [a.id, b.id]
        },
        confirmed: true
      };
    }

    // Default neutral interaction
    return {
      id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      simulationTime: timeStr,
      timeStepIndex: stepIdx,
      eventType: 'dialogue',
      locationId: loc.id,
      participantIds: [a.id, b.id],
      causeEventIds: causes,
      title: `${a.name} 与 ${b.name} 在${loc.name}擦肩而过`,
      description: `二人在${loc.name}共处片刻，互通三两句边陲风雪闲话，各自提防退后。`,
      consequences: ['未起冲突，暂归平静'],
      stateChanges: [],
      visibility: {
        isPublic: true,
        knownByCharacterIds: [a.id, b.id]
      },
      confirmed: true
    };
  }

  private static generateSoloAction(
    char: Character,
    loc: LocationNode,
    allLocs: LocationNode[],
    timeStr: string,
    stepIdx: number,
    history: WorldEvent[]
  ): WorldEvent | null {
    // Utility decision: Low health -> Rest; High anxiety -> move to connected location; Market -> investigate
    if (char.health < 70) {
      char.health = Math.min(100, char.health + 10);
      char.currentMood = '平静';
      return {
        id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'rest',
        locationId: loc.id,
        participantIds: [char.id],
        causeEventIds: [],
        title: `${char.name} 在${loc.name}休整疗伤`,
        description: `${char.name}寻得避风一隅，整理草药包并调理内息，神色略有缓和。`,
        consequences: [`健康度回升至 ${char.health}`],
        stateChanges: [
          { characterId: char.id, field: 'health', oldValue: char.health - 10, newValue: char.health }
        ],
        visibility: {
          isPublic: false,
          knownByCharacterIds: [char.id]
        },
        confirmed: true
      };
    }

    if (loc.type === 'market') {
      return {
        id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'discovery',
        locationId: loc.id,
        participantIds: [char.id],
        causeEventIds: [],
        title: `${char.name} 在${loc.name}捕捉到异样线索`,
        description: `${char.name}在鬼市泥摊上辨认出一枚带血符文断木，悄然收入袖中。`,
        consequences: [`获得隐蔽线索物品`],
        stateChanges: [],
        visibility: {
          isPublic: false,
          knownByCharacterIds: [char.id]
        },
        confirmed: true
      };
    }

    // Opportunity to travel to connected location
    if (loc.connectedLocationIds.length > 0 && Math.random() > 0.4) {
      const targetLocId = loc.connectedLocationIds[Math.floor(Math.random() * loc.connectedLocationIds.length)];
      const targetLoc = allLocs.find(l => l.id === targetLocId);
      if (targetLoc) {
        const oldLocId = char.currentLocationId;
        char.currentLocationId = targetLocId;
        return {
          id: `evt_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          simulationTime: timeStr,
          timeStepIndex: stepIdx,
          eventType: 'travel',
          locationId: targetLocId,
          participantIds: [char.id],
          causeEventIds: [],
          title: `${char.name} 冒雨移步前往 ${targetLoc.name}`,
          description: `${char.name}因心系线索，披戴蓑笠离开${loc.name}，循暗道抵至${targetLoc.name}。`,
          consequences: [`位置变更至 ${targetLoc.name}`],
          stateChanges: [
            { characterId: char.id, field: 'currentLocationId', oldValue: oldLocId, newValue: targetLocId }
          ],
          visibility: {
            isPublic: false,
            knownByCharacterIds: [char.id]
          },
          confirmed: true
        };
      }
    }

    return null;
  }

  /**
   * Epistemic boundaries update:
   * Only participants record facts from an event into their knownFacts graph.
   */
  private static propagateFactsFromEvent(event: WorldEvent, participants: Character[]): void {
    participants.forEach(char => {
      const factText = `亲历事件【${event.title}】：${event.description}`;
      if (!char.knownFacts.some(f => f.fact === factText)) {
        char.knownFacts.push({
          id: `f_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          fact: factText,
          learnedAtTime: event.simulationTime,
          sourceEventId: event.id,
          confidence: 1.0
        });
      }
    });
  }
}
