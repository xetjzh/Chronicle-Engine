import type { Character, WorldEvent, ProjectData, LocationNode } from '../types';
import { shortestPath, changeRelationship } from './worldDynamics.ts';

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
    if (!Number.isFinite(stepHours) || stepHours <= 0 || stepHours % 2 !== 0) throw new Error('模拟时间请使用正偶数小时。');
    const characters = JSON.parse(JSON.stringify(project.characters)) as Character[];
    const locations = project.locations;
    const existingEvents = [...project.events];
    const newEvents: WorldEvent[] = [];

    const nextTimeStepIndex = project.timeStepIndex + 1;
    const nextTimeStr = this.calculateNextTimeString(project.currentSimulationTime, stepHours);
    const travelling = new Set<string>();
    for (const char of characters.filter(c => c.isAlive)) {
      if (!char.travel && char.travelDestinationId && char.travelDestinationId !== char.currentLocationId) {
        const route = shortestPath(locations, char.currentLocationId, char.travelDestinationId);
        if (route.length) char.travel = { destinationId: char.travelDestinationId, route, remainingHours: locations.find(l => l.id === route[0])?.travelHours || 4 };
      }
      if (!char.travel) continue;
      travelling.add(char.id);
      const oldLocation = char.currentLocationId, trip = char.travel; let hours = stepHours;
      while (trip.route.length && hours > 0) {
        const here = locations.find(l => l.id === char.currentLocationId), next = locations.find(l => l.id === trip.route[0]);
        if (!next || !here?.connectedLocationIds.includes(next.id)) { char.travel = undefined; char.travelDestinationId = undefined; break; }
        if (hours < trip.remainingHours) { trip.remainingHours -= hours; hours = 0; break; }
        hours -= trip.remainingHours; char.currentLocationId = next.id; trip.route.shift();
        trip.remainingHours = locations.find(l => l.id === trip.route[0])?.travelHours || 4;
      }
      const arrived = char.currentLocationId === trip.destinationId;
      if (arrived) { char.travel = undefined; char.travelDestinationId = undefined; }
      const event: WorldEvent = { id: `evt_${crypto.randomUUID()}`, simulationTime: nextTimeStr, timeStepIndex: nextTimeStepIndex, eventType: 'travel', locationId: char.currentLocationId,
        participantIds: [char.id], causeEventIds: [], title: `${char.name}${arrived ? '抵达目的地' : char.travel ? '正在途中' : '中止旅行'}`,
        description: char.travel ? `沿连通路线前往 ${locations.find(l => l.id === trip.destinationId)?.name || trip.destinationId}，下一段还需 ${trip.remainingHours} 小时。` : arrived ? '已完成计划行程。' : '路线已变化，停留在最后到达的地点。',
        consequences: [], stateChanges: [{ characterId: char.id, field: 'currentLocationId', oldValue: oldLocation, newValue: char.currentLocationId }], visibility: { isPublic: false, knownByCharacterIds: [char.id] }, confirmed: true };
      newEvents.push(event); existingEvents.push(event); this.propagateFactsFromEvent(event, [char]);
    }

    // Group alive characters by location
    const aliveChars = characters.filter(c => c.isAlive && !travelling.has(c.id));
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

      const emit = (event: WorldEvent | null, participants: Character[]) => {
        if (!event) return; newEvents.push(event); existingEvents.push(event);
        this.propagateFactsFromEvent(event, participants);
      };
      // Rest is a personal need even when others share the location.
      const available: Character[] = [];
      for (const char of charsInLoc) {
        if (char.health < 70) emit(this.generateSoloAction(char, location, locations, nextTimeStr, nextTimeStepIndex, existingEvents), [char]);
        else available.push(char);
      }
      const offset = available.length ? project.timeStepIndex % available.length : 0;
      const ordered = [...available.slice(offset), ...available.slice(0, offset)];
      for (let index = 0; index < ordered.length; index += 2) {
        const first = ordered[index], second = ordered[index + 1];
        if (second) emit(this.generateSocialEncounter(first, second, location, nextTimeStr, nextTimeStepIndex, existingEvents), [first, second]);
        else emit(this.generateSoloAction(first, location, locations, nextTimeStr, nextTimeStepIndex, existingEvents), [first]);
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
    const basePrefix = currentTime.split(' ')[0] || '第1日';

    // Day rollover if index loops
    if (currIdx + steps >= hourTokens.length) {
      const days = Math.floor((currIdx + steps) / hourTokens.length);
      const prefix = /第\d+日/.test(basePrefix) ? basePrefix.replace(/第(\d+)日/, (_match, day) => `第${Number(day) + days}日`) : `${basePrefix}(${days}日后)`;
      return `${prefix} ${hourTokens[nextIdx]}`;
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
      const previousMoodA = a.currentMood, previousMoodB = b.currentMood;
      a.currentMood = '警惕';
      b.currentMood = '警惕';
      return {
        id: `evt_${crypto.randomUUID()}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'encounter',
        locationId: loc.id,
        participantIds: [a.id, b.id],
        causeEventIds: causes,
        title: `${a.name} 与 ${b.name} 在${loc.name}试探交锋`,
        description: `${a.name}与${b.name}在${loc.name}因既有关系相互试探，对彼此的行动保持警惕。`,
        consequences: ['双方情绪转为警惕'],
        stateChanges: [
          { characterId: a.id, field: 'currentMood', oldValue: previousMoodA, newValue: '警惕' },
          { characterId: b.id, field: 'currentMood', oldValue: previousMoodB, newValue: '警惕' },
          changeRelationship(a, b.id, -2, -3), changeRelationship(b, a.id, -2, -3)
        ],
        visibility: {
          isPublic: false,
          knownByCharacterIds: [a.id, b.id]
        },
        confirmed: true
      };
    } else if (relAtoB === '照顾' || relAtoB === '旧识') {
      const amount = Math.min(2, Math.max(0, a.wealth));
      const oldWealthA = a.wealth, oldWealthB = b.wealth;
      a.wealth -= amount; b.wealth += amount;
      return {
        id: `evt_${crypto.randomUUID()}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'dialogue',
        locationId: loc.id,
        participantIds: [a.id, b.id],
        causeEventIds: causes,
        title: `${a.name} 私下向 ${b.name} 传递风声`,
        description: `${a.name}在${loc.name}与${b.name}交流近况，并在力所能及的范围内提供支持。`,
        consequences: amount ? [`${a.name}向${b.name}转交 ${amount} 单位财物`] : ['完成一次交流，未转交财物'],
        stateChanges: [
          { characterId: a.id, field: 'wealth', oldValue: oldWealthA, newValue: a.wealth },
          { characterId: b.id, field: 'wealth', oldValue: oldWealthB, newValue: b.wealth },
          changeRelationship(a, b.id, 1, 1), changeRelationship(b, a.id, amount ? 5 : 1, amount ? 4 : 1)
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
      id: `evt_${crypto.randomUUID()}`,
      simulationTime: timeStr,
      timeStepIndex: stepIdx,
      eventType: 'dialogue',
      locationId: loc.id,
      participantIds: [a.id, b.id],
      causeEventIds: causes,
      title: `${a.name} 与 ${b.name} 在${loc.name}擦肩而过`,
      description: `${a.name}与${b.name}在${loc.name}短暂交流，随后各自继续当前事务。`,
      consequences: ['未起冲突，暂归平静'],
      stateChanges: [changeRelationship(a, b.id, 1, 1), changeRelationship(b, a.id, 1, 1)],
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
        id: `evt_${crypto.randomUUID()}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'rest',
        locationId: loc.id,
        participantIds: [char.id],
        causeEventIds: [],
        title: `${char.name} 在${loc.name}休整疗伤`,
        description: `${char.name}在${loc.name}休息并恢复体力。`,
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
        id: `evt_${crypto.randomUUID()}`,
        simulationTime: timeStr,
        timeStepIndex: stepIdx,
        eventType: 'discovery',
        locationId: loc.id,
        participantIds: [char.id],
        causeEventIds: [],
        title: `${char.name} 在${loc.name}捕捉到异样线索`,
        description: `${char.name}在${loc.name}收集公开信息，整理与当前目标相关的线索。`,
        consequences: ['记录一次当地信息收集经历'],
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
        char.travelDestinationId = targetLocId;
        char.travel = { destinationId: targetLocId, route: [targetLocId], remainingHours: targetLoc.travelHours || 4 };
        return {
          id: `evt_${crypto.randomUUID()}`,
          simulationTime: timeStr,
          timeStepIndex: stepIdx,
          eventType: 'travel',
          locationId: oldLocId,
          participantIds: [char.id],
          causeEventIds: [],
          title: `${char.name} 启程前往 ${targetLoc.name}`,
          description: `${char.name}离开${loc.name}，沿已知路线前往${targetLoc.name}。`,
          consequences: [`旅行开始，尚未抵达 ${targetLoc.name}`],
          stateChanges: [
            { characterId: char.id, field: 'travel', oldValue: undefined, newValue: char.travel }
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
          id: `f_${crypto.randomUUID()}`,
          fact: factText,
          learnedAtTime: event.simulationTime,
          sourceEventId: event.id,
          confidence: 1.0
        });
      }
    });
  }
}
