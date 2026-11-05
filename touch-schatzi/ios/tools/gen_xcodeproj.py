#!/usr/bin/env python3
"""Generates TouchSchatzi.xcodeproj (project.pbxproj + shared scheme) deterministically.

Why a generator: the project is committed so it opens straight in Xcode, but it is written from this one
readable description instead of by hand. Edit the lists below, run `python3 ios/tools/gen_xcodeproj.py`,
commit the result. IDs are stable hashes of names so diffs stay small.

The web game is NOT copied: `www` is a folder reference to ../app/src/main/assets/www, the exact folder the
Android app ships, so both platforms always run identical game code and art.
"""
import hashlib
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ_DIR = os.path.normpath(os.path.join(HERE, '..', 'TouchSchatzi.xcodeproj'))

APP = 'TouchSchatzi'
TESTS = 'TouchSchatziTests'
BUNDLE_ID = 'com.touchschatzi.game'   # same identifier as the Android applicationId
MARKETING_VERSION = '1.0.0'           # keep in step with versionName in app/build.gradle
BUILD_NUMBER = '1'                    # bump for every TestFlight upload (or let CI set it)
DEPLOYMENT_TARGET = '16.0'
WWW_PATH = '../app/src/main/assets/www'

APP_GROUPS = {
    'App': ['AppDelegate.swift', 'SceneDelegate.swift', 'AudioSessionController.swift', 'Theme.swift'],
    'Web': ['GameViewController.swift', 'AssetSchemeHandler.swift', 'NativeBridge.swift', 'NativeStore.swift',
            'HapticPattern.swift', 'HapticsEngine.swift', 'LoadErrorView.swift'],
}
RESOURCE_FILES = ['Assets.xcassets', 'PrivacyInfo.xcprivacy']   # in TouchSchatzi/Resources
TEST_FILES = ['AssetSchemeHandlerTests.swift', 'HapticPatternTests.swift', 'NativeStoreTests.swift']


def uid(name):
    return hashlib.md5(('TouchSchatzi:' + name).encode()).hexdigest()[:24].upper()


def q(s):
    """Quote a pbxproj string only when needed."""
    if s and all(c.isalnum() or c in '._/' for c in s) and not s[0].isdigit():
        return s
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'


FILE_TYPES = {'.swift': 'sourcecode.swift', '.plist': 'text.plist.xml', '.xcprivacy': 'text.xml',
              '.xcassets': 'folder.assetcatalog'}


def ftype(name):
    return FILE_TYPES[os.path.splitext(name)[1]]


def settings(d):
    return '{\n' + ''.join(f'\t\t\t\t{k} = {v};\n' for k, v in sorted(d.items())) + '\t\t\t}'


def build():
    objs = []          # (section, id, text)

    def add(section, id_, text):
        objs.append((section, id_, text))

    # ---- file references
    ref = {}
    for g, files in APP_GROUPS.items():
        for f in files:
            ref[f] = uid('ref:' + f)
            add('PBXFileReference', ref[f], f'{{isa = PBXFileReference; lastKnownFileType = {ftype(f)}; path = {q(f)}; sourceTree = "<group>"; }}')
    for f in RESOURCE_FILES:
        ref[f] = uid('ref:' + f)
        add('PBXFileReference', ref[f], f'{{isa = PBXFileReference; lastKnownFileType = {ftype(f)}; path = {q(f)}; sourceTree = "<group>"; }}')
    ref['Info.plist'] = uid('ref:Info.plist')
    add('PBXFileReference', ref['Info.plist'], '{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; }')
    for f in TEST_FILES:
        ref[f] = uid('ref:' + f)
        add('PBXFileReference', ref[f], f'{{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(f)}; sourceTree = "<group>"; }}')
    ref['www'] = uid('ref:www')
    add('PBXFileReference', ref['www'], f'{{isa = PBXFileReference; lastKnownFileType = folder; name = www; path = {q(WWW_PATH)}; sourceTree = "<group>"; }}')
    app_prod, test_prod = uid('product:app'), uid('product:tests')
    add('PBXFileReference', app_prod, f'{{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = {APP}.app; sourceTree = BUILT_PRODUCTS_DIR; }}')
    add('PBXFileReference', test_prod, f'{{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = {TESTS}.xctest; sourceTree = BUILT_PRODUCTS_DIR; }}')

    # ---- build files
    bf = {}

    def build_file(name, phase):
        bf[(name, phase)] = uid(f'bf:{name}:{phase}')
        add('PBXBuildFile', bf[(name, phase)], f'{{isa = PBXBuildFile; fileRef = {ref[name]} /* {name} */; }}')
        return bf[(name, phase)]

    app_sources = [build_file(f, 'app-src') for files in APP_GROUPS.values() for f in files]
    app_resources = [build_file(f, 'app-res') for f in RESOURCE_FILES] + [build_file('www', 'app-res')]
    test_sources = [build_file(f, 'test-src') for f in TEST_FILES]

    # ---- groups
    def group(id_, name, path, children, comment=None):
        kids = ''.join(f'\n\t\t\t\t{c} /* {n} */,' for c, n in children)
        p = f'path = {q(path)}; ' if path else ''
        nm = f'name = {q(name)}; ' if name and name != path else ''
        add('PBXGroup', id_, f'{{\n\t\t\tisa = PBXGroup;\n\t\t\tchildren = ({kids}\n\t\t\t);\n\t\t\t{nm}{p}sourceTree = "<group>";\n\t\t}}')

    g_app, g_web, g_res = uid('g:App'), uid('g:Web'), uid('g:Resources')
    group(g_app, 'App', 'App', [(ref[f], f) for f in APP_GROUPS['App']])
    group(g_web, 'Web', 'Web', [(ref[f], f) for f in APP_GROUPS['Web']])
    group(g_res, 'Resources', 'Resources', [(ref[f], f) for f in RESOURCE_FILES] + [(ref['Info.plist'], 'Info.plist')])
    g_app_root, g_tests, g_products, g_main = uid('g:TouchSchatzi'), uid('g:Tests'), uid('g:Products'), uid('g:Main')
    group(g_app_root, APP, APP, [(g_app, 'App'), (g_web, 'Web'), (g_res, 'Resources')])
    group(g_tests, TESTS, TESTS, [(ref[f], f) for f in TEST_FILES])
    group(g_products, 'Products', None, [(app_prod, f'{APP}.app'), (test_prod, f'{TESTS}.xctest')])
    group(g_main, None, None, [(g_app_root, APP), (g_tests, TESTS), (ref['www'], 'www'), (g_products, 'Products')])

    # ---- build phases
    ph = {k: uid('phase:' + k) for k in ('app-src', 'app-fw', 'app-res', 'test-src', 'test-fw', 'test-res')}

    def phase(kind, key, files):
        items = ''.join(f'\n\t\t\t\t{f},' for f in files)
        add(kind, ph[key], f'{{\n\t\t\tisa = {kind};\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = ({items}\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}}')

    phase('PBXSourcesBuildPhase', 'app-src', app_sources)
    phase('PBXFrameworksBuildPhase', 'app-fw', [])
    phase('PBXResourcesBuildPhase', 'app-res', app_resources)
    phase('PBXSourcesBuildPhase', 'test-src', test_sources)
    phase('PBXFrameworksBuildPhase', 'test-fw', [])
    phase('PBXResourcesBuildPhase', 'test-res', [])

    # ---- build configurations
    common = {
        'ALWAYS_SEARCH_USER_PATHS': 'NO', 'CLANG_ENABLE_MODULES': 'YES', 'CLANG_ENABLE_OBJC_ARC': 'YES',
        'COPY_PHASE_STRIP': 'NO', 'ENABLE_STRICT_OBJC_MSGSEND': 'YES', 'GCC_NO_COMMON_BLOCKS': 'YES',
        'IPHONEOS_DEPLOYMENT_TARGET': DEPLOYMENT_TARGET, 'SDKROOT': 'iphoneos', 'SWIFT_VERSION': '5.0',
        'CLANG_WARN_DOCUMENTATION_COMMENTS': 'YES', 'CLANG_WARN_UNREACHABLE_CODE': 'YES',
    }
    proj_debug = dict(common, DEBUG_INFORMATION_FORMAT='dwarf', ENABLE_TESTABILITY='YES', GCC_OPTIMIZATION_LEVEL='0',
                      MTL_ENABLE_DEBUG_INFO='INCLUDE_SOURCE', ONLY_ACTIVE_ARCH='YES',
                      SWIFT_ACTIVE_COMPILATION_CONDITIONS='DEBUG', SWIFT_OPTIMIZATION_LEVEL='"-Onone"')
    proj_release = dict(common, DEBUG_INFORMATION_FORMAT='"dwarf-with-dsym"', ENABLE_NS_ASSERTIONS='NO',
                        MTL_ENABLE_DEBUG_INFO='NO', SWIFT_COMPILATION_MODE='wholemodule', VALIDATE_PRODUCT='YES')
    app_common = {
        'ASSETCATALOG_COMPILER_APPICON_NAME': 'AppIcon', 'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME': 'AccentColor',
        'CODE_SIGN_STYLE': 'Automatic', 'CURRENT_PROJECT_VERSION': BUILD_NUMBER,
        'DEVELOPMENT_TEAM': '""',  # set your Apple Developer Team in Xcode (Signing & Capabilities) before archiving
        'ENABLE_USER_SCRIPT_SANDBOXING': 'YES', 'GENERATE_INFOPLIST_FILE': 'NO',
        'INFOPLIST_FILE': f'{APP}/Resources/Info.plist', 'LD_RUNPATH_SEARCH_PATHS': '"$(inherited) @executable_path/Frameworks"',
        'MARKETING_VERSION': MARKETING_VERSION, 'PRODUCT_BUNDLE_IDENTIFIER': BUNDLE_ID,
        'PRODUCT_NAME': '"$(TARGET_NAME)"', 'SUPPORTS_MACCATALYST': 'NO',
        'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD': 'NO', 'SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD': 'NO',
        'SWIFT_EMIT_LOC_STRINGS': 'NO', 'TARGETED_DEVICE_FAMILY': '"1,2"',
    }
    test_common = {
        'BUNDLE_LOADER': '"$(TEST_HOST)"', 'CODE_SIGN_STYLE': 'Automatic', 'CURRENT_PROJECT_VERSION': BUILD_NUMBER,
        'DEVELOPMENT_TEAM': '""', 'GENERATE_INFOPLIST_FILE': 'YES', 'MARKETING_VERSION': MARKETING_VERSION,
        'PRODUCT_BUNDLE_IDENTIFIER': BUNDLE_ID + '.tests', 'PRODUCT_NAME': '"$(TARGET_NAME)"',
        'SWIFT_EMIT_LOC_STRINGS': 'NO', 'TARGETED_DEVICE_FAMILY': '"1,2"',
        'TEST_HOST': f'"$(BUILT_PRODUCTS_DIR)/{APP}.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/{APP}"',
    }
    # TEST_HOST on iOS is $(BUILT_PRODUCTS_DIR)/App.app/App (no extra folder path)
    test_common['TEST_HOST'] = f'"$(BUILT_PRODUCTS_DIR)/{APP}.app/{APP}"'
    cfg = {}
    for key, debug, release in (('proj', proj_debug, proj_release), ('app', app_common, app_common), ('test', test_common, test_common)):
        for name, d in (('Debug', debug), ('Release', release)):
            cfg[(key, name)] = uid(f'cfg:{key}:{name}')
            add('XCBuildConfiguration', cfg[(key, name)], f'{{\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {settings(d)};\n\t\t\tname = {name};\n\t\t}}')
    lists = {}
    for key, label in (('proj', f'PBXProject "{APP}"'), ('app', f'PBXNativeTarget "{APP}"'), ('test', f'PBXNativeTarget "{TESTS}"')):
        lists[key] = uid('cfglist:' + key)
        add('XCConfigurationList', lists[key],
            f'{{\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t{cfg[(key, "Debug")]} /* Debug */,\n\t\t\t\t{cfg[(key, "Release")]} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t}}')

    # ---- targets
    t_app, t_test, project = uid('target:app'), uid('target:tests'), uid('project')
    proxy, dep = uid('proxy'), uid('dependency')
    add('PBXContainerItemProxy', proxy, f'{{\n\t\t\tisa = PBXContainerItemProxy;\n\t\t\tcontainerPortal = {project} /* Project object */;\n\t\t\tproxyType = 1;\n\t\t\tremoteGlobalIDString = {t_app};\n\t\t\tremoteInfo = {APP};\n\t\t}}')
    add('PBXTargetDependency', dep, f'{{\n\t\t\tisa = PBXTargetDependency;\n\t\t\ttarget = {t_app} /* {APP} */;\n\t\t\ttargetProxy = {proxy} /* PBXContainerItemProxy */;\n\t\t}}')
    add('PBXNativeTarget', t_app,
        f'{{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {lists["app"]} /* Build configuration list for PBXNativeTarget "{APP}" */;\n\t\t\tbuildPhases = (\n\t\t\t\t{ph["app-src"]} /* Sources */,\n\t\t\t\t{ph["app-fw"]} /* Frameworks */,\n\t\t\t\t{ph["app-res"]} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = {APP};\n\t\t\tproductName = {APP};\n\t\t\tproductReference = {app_prod} /* {APP}.app */;\n\t\t\tproductType = "com.apple.product-type.application";\n\t\t}}')
    add('PBXNativeTarget', t_test,
        f'{{\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = {lists["test"]} /* Build configuration list for PBXNativeTarget "{TESTS}" */;\n\t\t\tbuildPhases = (\n\t\t\t\t{ph["test-src"]} /* Sources */,\n\t\t\t\t{ph["test-fw"]} /* Frameworks */,\n\t\t\t\t{ph["test-res"]} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t\t{dep} /* PBXTargetDependency */,\n\t\t\t);\n\t\t\tname = {TESTS};\n\t\t\tproductName = {TESTS};\n\t\t\tproductReference = {test_prod} /* {TESTS}.xctest */;\n\t\t\tproductType = "com.apple.product-type.bundle.unit-test";\n\t\t}}')
    add('PBXProject', project,
        f'{{\n\t\t\tisa = PBXProject;\n\t\t\tattributes = {{\n\t\t\t\tBuildIndependentTargetsInParallel = 1;\n\t\t\t\tLastSwiftUpdateCheck = 1600;\n\t\t\t\tLastUpgradeCheck = 1600;\n\t\t\t\tTargetAttributes = {{\n\t\t\t\t\t{t_app} = {{\n\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;\n\t\t\t\t\t}};\n\t\t\t\t\t{t_test} = {{\n\t\t\t\t\t\tCreatedOnToolsVersion = 16.0;\n\t\t\t\t\t\tTestTargetID = {t_app};\n\t\t\t\t\t}};\n\t\t\t\t}};\n\t\t\t}};\n\t\t\tbuildConfigurationList = {lists["proj"]} /* Build configuration list for PBXProject "{APP}" */;\n\t\t\tcompatibilityVersion = "Xcode 14.0";\n\t\t\tdevelopmentRegion = en;\n\t\t\thasScannedForEncodings = 0;\n\t\t\tknownRegions = (\n\t\t\t\ten,\n\t\t\t\tBase,\n\t\t\t);\n\t\t\tmainGroup = {g_main};\n\t\t\tproductRefGroup = {g_products} /* Products */;\n\t\t\tprojectDirPath = "";\n\t\t\tprojectRoot = "";\n\t\t\ttargets = (\n\t\t\t\t{t_app} /* {APP} */,\n\t\t\t\t{t_test} /* {TESTS} */,\n\t\t\t);\n\t\t}}')

    # ---- serialise
    order = ['PBXBuildFile', 'PBXContainerItemProxy', 'PBXFileReference', 'PBXFrameworksBuildPhase', 'PBXGroup',
             'PBXNativeTarget', 'PBXProject', 'PBXResourcesBuildPhase', 'PBXSourcesBuildPhase', 'PBXTargetDependency',
             'XCBuildConfiguration', 'XCConfigurationList']
    out = ['// !$*UTF8*$!', '{', '\tarchiveVersion = 1;', '\tclasses = {', '\t};', '\tobjectVersion = 56;', '\tobjects = {', '']
    for sec in order:
        items = sorted([o for o in objs if o[0] == sec], key=lambda o: o[1])
        if not items:
            continue
        out.append(f'/* Begin {sec} section */')
        for _, id_, text in items:
            out.append(f'\t\t{id_} = {text};')
        out.append(f'/* End {sec} section */')
        out.append('')
    out += ['\t};', f'\trootObject = {project} /* Project object */;', '}', '']
    pbx = '\n'.join(out)

    scheme = f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{t_app}"
               BuildableName = "{APP}.app"
               BlueprintName = "{APP}"
               ReferencedContainer = "container:{APP}.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES">
      <Testables>
         <TestableReference
            skipped = "NO">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{t_test}"
               BuildableName = "{TESTS}.xctest"
               BlueprintName = "{TESTS}"
               ReferencedContainer = "container:{APP}.xcodeproj">
            </BuildableReference>
         </TestableReference>
      </Testables>
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{t_app}"
            BuildableName = "{APP}.app"
            BlueprintName = "{APP}"
            ReferencedContainer = "container:{APP}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{t_app}"
            BuildableName = "{APP}.app"
            BlueprintName = "{APP}"
            ReferencedContainer = "container:{APP}.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
'''
    return pbx, scheme


def main():
    pbx, scheme = build()
    os.makedirs(os.path.join(PROJ_DIR, 'xcshareddata', 'xcschemes'), exist_ok=True)
    with open(os.path.join(PROJ_DIR, 'project.pbxproj'), 'w') as f:
        f.write(pbx)
    with open(os.path.join(PROJ_DIR, 'xcshareddata', 'xcschemes', f'{APP}.xcscheme'), 'w') as f:
        f.write(scheme)
    # verify every source file named above exists
    base = os.path.join(HERE, '..')
    missing = [p for p in ([f'{APP}/{g}/{f}' for g, fs in APP_GROUPS.items() for f in fs] +
                           [f'{APP}/Resources/{f}' for f in RESOURCE_FILES] + [f'{APP}/Resources/Info.plist'] +
                           [f'{TESTS}/{f}' for f in TEST_FILES]) if not os.path.exists(os.path.join(base, p))]
    www = os.path.normpath(os.path.join(base, WWW_PATH, 'index.html'))
    if not os.path.exists(www):
        missing.append(www)
    if missing:
        raise SystemExit('missing files: ' + ', '.join(missing))
    print('wrote', PROJ_DIR)


if __name__ == '__main__':
    main()
