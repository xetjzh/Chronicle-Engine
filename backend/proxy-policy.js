/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
const API_CLIENT_MAP = [
 {
    name: "VertexGenAi:generateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:generateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:generateContent`;
    },
    getLinkedResourceName: null,
    bodyPolicy: "generate_content",
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:predict",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:predict",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:predict`;
    },
    getLinkedResourceName: null,
    bodyPolicy: "opaque",
    isStreaming: false,
    transformFn: null,
  },
 {
    name: "VertexGenAi:streamGenerateContent",
    patternForProxy: "https://aiplatform.googleapis.com/{{version}}/publishers/google/models/{{model}}:streamGenerateContent",
    getApiEndpoint: (context, params) => {
      return `https://aiplatform.clients6.google.com/${params['version']}/projects/${context.projectId}/locations/${context.region}/publishers/google/models/${params['model']}:streamGenerateContent`;
    },
    getLinkedResourceName: null,
    bodyPolicy: "generate_content",
    isStreaming: true,
    transformFn: null,
  },
].map((client) => ({ ...client, patternInfo: parsePattern(client.patternForProxy) }));

// IMPORTANT: Vertex AI Studio SSRF Protection
// The set below is the exhaustive allow-list of upstream hostnames this
// proxy may forward authenticated requests to. It is sourced at code
// generation time from the RestApiClient.getAllowedUpstreamHosts() of every
// client embedded in API_CLIENT_MAP. Removing, weakening, or widening this
// check (for example, by adding wildcards or computing entries from request
// data) re-introduces the SSRF vulnerability that allows the deployed
// service account's OAuth access token to be exfiltrated to an
// attacker-controlled host.
const ALLOWED_UPSTREAM_HOSTS = new Set([
  "aiplatform.clients6.google.com",
]);

const ALLOWED_LINKED_RESOURCES = new Set();

const WEB_SOCKET_BODY_POLICY = "live_bidi";

const ALLOWED_GENERATE_CONTENT_ROOT_FIELDS = new Set(["contents", "generationConfig", "generation_config", "labels", "model", "safetySettings", "safety_settings", "systemInstruction", "system_instruction", "toolConfig", "tool_config", "tools"]);
const ALLOWED_CONTENT_FIELDS = new Set(["parts", "role"]);
const ALLOWED_PART_FIELDS = new Set(["codeExecutionResult", "code_execution_result", "executableCode", "executable_code", "functionCall", "function_call", "functionResponse", "function_response", "inlineData", "inline_data", "text", "thought", "thoughtSignature", "thought_signature", "videoMetadata", "video_metadata"]);
const ALLOWED_TOOL_FIELDS = new Set(["codeExecution", "code_execution", "enterpriseWebSearch", "enterprise_web_search", "functionDeclarations", "function_declarations", "googleSearch", "googleSearchRetrieval", "google_search", "google_search_retrieval"]);
const LOWERCASED_CONTENT_VALUED_FIELDS = new Set(["contents", "systeminstruction", "system_instruction", "turns"]);
const FREE_TEXT_FIELDS = new Set(["data", "text", "thoughtSignature", "thought_signature"]);
const OPAQUE_FIELDS = new Set(["args", "functionDeclarations", "function_declarations", "response", "responseJsonSchema", "responseSchema", "response_json_schema", "response_schema"]);
const DEREFERENCED_URI_SCHEMES = ["bigquery://","gs://"];
const MAX_BODY_DEPTH = 64;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstDisallowedKey(node, allowed) {
  for (const key of Object.keys(node)) {
    if (!allowed.has(key)) return key;
  }
  return null;
}

function describeUnknownField(kind, key) {
  return kind + ' field is not allowed in a proxied request: ' + key;
}

function findStringViolation(value, parentKey) {
  if (parentKey !== undefined && FREE_TEXT_FIELDS.has(parentKey)) return null;
  const normalized = value.trim().toLowerCase();
  for (const scheme of DEREFERENCED_URI_SCHEMES) {
    if (normalized.startsWith(scheme)) {
      return 'a proxied request may not reference storage by URI (' + scheme +
        '), because the proxy would read it with the credential of the deployed app';
    }
  }
  return null;
}

function findObjectKeyViolation(node, parentKey) {
  const slot = (parentKey ?? '').toLowerCase();
  if (slot === 'parts') {
    const key = firstDisallowedKey(node, ALLOWED_PART_FIELDS);
    return key ? describeUnknownField('Part', key) : null;
  }
  if (slot === 'tools') {
    const key = firstDisallowedKey(node, ALLOWED_TOOL_FIELDS);
    return key ? describeUnknownField('Tool', key) : null;
  }
  if (LOWERCASED_CONTENT_VALUED_FIELDS.has(slot)) {
    const key = firstDisallowedKey(node, ALLOWED_CONTENT_FIELDS);
    return key ? describeUnknownField('Content', key) : null;
  }
  return null;
}

function findSchemeViolation(node, parentKey, depth) {
  if (depth > MAX_BODY_DEPTH) {
    return 'request body nests deeper than ' + MAX_BODY_DEPTH + ' levels';
  }
  if (typeof node === 'string') return findStringViolation(node, parentKey);
  if (Array.isArray(node)) {
    for (const element of node) {
      const violation = findSchemeViolation(element, parentKey, depth + 1);
      if (violation) return violation;
    }
    return null;
  }
  if (!isPlainObject(node)) return null;
  for (const key of Object.keys(node)) {
    const violation = findSchemeViolation(node[key], key, depth + 1);
    if (violation) return violation;
  }
  return null;
}

function findViolation(node, parentKey, depth) {
  if (parentKey !== undefined && OPAQUE_FIELDS.has(parentKey)) return null;
  if (depth > MAX_BODY_DEPTH) {
    return 'request body nests deeper than ' + MAX_BODY_DEPTH + ' levels';
  }
  if (typeof node === 'string') return findStringViolation(node, parentKey);
  if (Array.isArray(node)) {
    for (const element of node) {
      const violation = findViolation(element, parentKey, depth + 1);
      if (violation) return violation;
    }
    return null;
  }
  if (!isPlainObject(node)) return null;
  const keyViolation = findObjectKeyViolation(node, parentKey);
  if (keyViolation) return keyViolation;
  for (const key of Object.keys(node)) {
    const violation = findViolation(node[key], key, depth + 1);
    if (violation) return violation;
  }
  return null;
}

function validateProxiedRequestBody(bodyText, policy) {
  if (bodyText === undefined || bodyText === null || bodyText === '') {
    return { allowed: true };
  }
  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    return { allowed: false, reason: 'request body is not valid JSON' };
  }
  if (!isPlainObject(body)) {
    return { allowed: false, reason: 'request body must be a JSON object' };
  }
  if (policy === 'generate_content') {
    const key = firstDisallowedKey(body, ALLOWED_GENERATE_CONTENT_ROOT_FIELDS);
    if (key) return { allowed: false, reason: describeUnknownField('Request', key) };
  }
  const violation = policy === 'opaque'
    ? findSchemeViolation(body, undefined, 0)
    : findViolation(body, undefined, 0);
  return violation ? { allowed: false, reason: violation } : { allowed: true };
}

function asProxiedBodyText(body) {
  if (body === undefined || body === null || typeof body === 'string') return body;
  return JSON.stringify(body);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePattern(pattern) {
  const paramRegex = /\{\{(.*?)\}\}/g;
  const params = [];
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = paramRegex.exec(pattern)) !== null) {
    params.push(match[1]);
    const literalPart = pattern.substring(lastIndex, match.index);
    parts.push(escapeRegex(literalPart));
    parts.push(`(?<${match[1]}>[A-Za-z0-9\-_.!~*'():@]+)`);
    lastIndex = paramRegex.lastIndex;
  }
  parts.push(escapeRegex(pattern.substring(lastIndex)));
  const regexString = parts.join('');

  return {regex: new RegExp(`^${regexString}$`), params};
}

function isSafePathSegment(value) {
  return !!value && value !== '.' && value !== '..' && encodeURIComponent(value).replace(/%3A/g, ':').replace(/%40/g, '@') === value;
}

function extractParams(patternInfo, url) {
  const match = url.match(patternInfo.regex);
  if (!match) return null;
  const params = {};
  for (let i = 0; i < patternInfo.params.length; i++) {
    const value = match[i + 1];
    if (!isSafePathSegment(value)) return null;
    params[patternInfo.params[i]] = value;
  }
  return params;
}

const FORWARDABLE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "x-goog-api-client",
]);

const STUDIO_CLIENT_TAG = "vertex-agent-studio-app-export/1";

function sanitizeForwardedHeaders(requestHeaders) {
  const forwardable = {};
  for (const [name, value] of Object.entries(requestHeaders || {})) {
    if (FORWARDABLE_REQUEST_HEADERS.has(name.toLowerCase())) {
      forwardable[name.toLowerCase()] = value;
    }
  }
  forwardable['x-goog-api-client'] = forwardable['x-goog-api-client']
    ? `${forwardable['x-goog-api-client']} ${STUDIO_CLIENT_TAG}`
    : STUDIO_CLIENT_TAG;
  return forwardable;
}


export { API_CLIENT_MAP, ALLOWED_UPSTREAM_HOSTS, WEB_SOCKET_BODY_POLICY, validateProxiedRequestBody, asProxiedBodyText, extractParams, sanitizeForwardedHeaders, STUDIO_CLIENT_TAG };
