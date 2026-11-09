-- Loaded by the official OBS application only. All obslua functions stay native.
-- The only transport change is trusting the isolated fixture's certificate.
local obs = obslua
local ffi = require("ffi")
local jit = require("jit")
local config = dofile(assert(os.getenv("DZR_OBS_SMOKE_CONFIG")))
local evidence = {
    obsVersion = obs.obs_get_version_string(),
    luaJIT = jit.version,
    ffiOS = ffi.os,
    loaded = false, updated = false, properties = false,
    buttonClicked = false, accepted = false, unloaded = false,
}

local function record()
    local data = obs.obs_data_create()
    for name, value in pairs(evidence) do
        if type(value) == "boolean" then obs.obs_data_set_bool(data, name, value)
        else obs.obs_data_set_string(data, name, tostring(value)) end
    end
    local file = assert(io.open(config.evidenceFile, "w"))
    file:write(obs.obs_data_get_json(data))
    file:close()
    obs.obs_data_release(data)
end

local native_log = obs.script_log
obs.script_log = function(level, message)
    native_log(level, message)
    if message:find("Signal modtaget af DZR.", 1, true) then evidence.accepted = true end
    if level == obs.LOG_ERROR then evidence.error = message end
    record()
end

ffi.cdef[[const char *curl_version(void);]]
local native_ffi_load = ffi.load
ffi.load = function(name, ...)
    local library = native_ffi_load(name, ...)
    -- The production asset chooses its actual platform library. Preserve that choice.
    if not tostring(name):lower():find("curl", 1, true) then return library end
    evidence.curlLibrary = name
    evidence.curlVersion = ffi.string(library.curl_version())
    record()
    return setmetatable({ curl_easy_init = function()
        local handle = library.curl_easy_init()
        if handle ~= nil then
            -- CURLOPT_CAINFO and CURLOPT_NOPROXY. TLS verification remains enabled.
            assert(library.curl_easy_setopt(handle, 10065, config.caFile) == 0,
                "native libcurl rejected the fixture CA")
            assert(library.curl_easy_setopt(handle, 10177, "*") == 0,
                "native libcurl rejected the loopback proxy exclusion")
        end
        return handle
    end }, { __index = library })
end

-- Execute the unchanged production asset in OBS's own LuaJIT state.
dofile(config.productionScript)
local production_load, production_update = script_load, script_update
local production_properties, production_unload = script_properties, script_unload
local properties

function script_properties()
    local result = production_properties()
    assert(obs.obs_properties_get(result, "endpoint") ~= nil, "missing endpoint property")
    local key = obs.obs_properties_get(result, "key")
    assert(key ~= nil and obs.obs_property_text_type(key) == obs.OBS_TEXT_PASSWORD,
        "the real key property must mask its value")
    assert(obs.obs_properties_get(result, "video_link") ~= nil, "missing video link property")
    assert(obs.obs_properties_get(result, "test") ~= nil, "missing test button")
    evidence.properties = true
    record()
    return result
end

function script_update(settings)
    production_update(settings)
    evidence.updated = true
    record()
end

local function click_test_button()
    obs.timer_remove(click_test_button)
    local ok, message = pcall(function()
        properties = script_properties()
        local button = obs.obs_properties_get(properties, "test")
        -- This invokes OBS's registered native button callback and its Lua bridge.
        obs.obs_property_button_clicked(button, nil)
        evidence.buttonClicked = true
        record()
    end)
    if not ok then obs.script_log(obs.LOG_ERROR, "Native OBS smoke: " .. tostring(message)) end
end
-- Calling a native property can re-enter Lua through OBS's callback bridge.
jit.off(click_test_button, true)

function script_load(settings)
    assert(evidence.obsVersion == config.expectedVersion,
        "unexpected OBS application version: " .. evidence.obsVersion)
    assert(jit.version:find("LuaJIT", 1, true), "OBS must use its native LuaJIT runtime")
    production_load(settings)
    evidence.loaded = true
    record()
    obs.timer_add(click_test_button, 500)
end

function script_unload()
    obs.timer_remove(click_test_button)
    production_unload()
    if properties then obs.obs_properties_destroy(properties); properties = nil end
    evidence.unloaded = true
    record()
end

record()
