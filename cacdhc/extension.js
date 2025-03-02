const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

const themeFilePath = "./themes/theme.json";
const configPropertyName = "cacdhc.accentuationColor";
const commandName = "extension.changeAccentuationColor";
const regexHexadecimalColor = new RegExp("^#?[A-Fa-f0-9]{6}$");
const customLabel = "custom";

const colors = {
    "black": "#000000",
    "blue": "#0000FF",
    "brown": "#A52A2A",
    "cyan": "#00FFFF",
    "gold": "#FFD700",
    "gray": "#808080",
    "green": "#00FF00",
    "lime": "#00FF00",
    "magenta": "#FF00FF",
    "maroon": "#800000",
    "navy": "#000080",
    "olive": "#808000",
    "orange": "#FFA500",
    "pink": "#FFC0CB",
    "purple": "#800080",
    "red": "#FF0000",
    "silver": "#C0C0C0",
    "teal": "#008080",
    "white": "#FFFFFF",
    "yellow": "#FFFF00"
};

const itemsToUpdate = [
    "activityBar.activeBorder",
    "activityBar.activeFocusBorder",
    "activityBar.border",
    "activityBar.dropBorder",
    "button.border",
    "checkbox.border",
    "contrastActiveBorder",
    "contrastBorder",
    "debugExceptionWidget.border",
    "debugToolBar.border",
    "diffEditor.border",
    "dropdown.border",
    "editor.findMatchBorder",
    "editor.findMatchHighlightBorder",
    "editor.findRangeHighlightBorder",
    "editor.lineHighlightBorder",
    "editor.rangeHighlightBorder",
    "editor.selectionHighlightBorder",
    "editor.snippetFinalTabstopHighlightBorder",
    "editor.snippetTabstopHighlightBorder",
    "editor.symbolHighlightBorder",
    "editor.wordHighlightBorder",
    "editor.wordHighlightStrongBorder",
    "editorBracketMatch.border",
    "editorCommentsWidget.resolvedBorder",
    "editorCommentsWidget.unresolvedBorder",
    "editorError.border",
    "editorGhostText.border",
    "editorGroup.border",
    "editorGroup.dropIntoPromptBorder",
    "editorGroup.focusedEmptyBorder",
    "editorGroupHeader.border",
    "editorGroupHeader.tabsBorder",
    "editorHint.border",
    "editorHoverWidget.border",
    "editorInfo.border",
    "editorOverviewRuler.border",
    "editorSuggestWidget.border",
    "editorUnicodeHighlight.border",
    "editorUnnecessaryCode.border",
    "editorWarning.border",
    "editorWidget.border",
    "editorWidget.resizeBorder",
    "focusBorder",
    "input.border",
    "inputOption.activeBorder",
    "inputValidation.errorBorder",
    "inputValidation.infoBorder",
    "inputValidation.warningBorder",
    "interactive.activeCodeBorder",
    "interactive.inactiveCodeBorder",
    "keybindingLabel.border",
    "keybindingLabel.bottomBorder",
    "list.filterMatchBorder",
    "menu.border",
    "menu.selectionBorder",
    "menubar.selectionBorder",
    "merge.border",
    "notebook.focusedCellBorder",
    "notebook.focusedEditorBorder",
    "notebook.inactiveFocusedCellBorder",
    "notebook.inactiveSelectedCellBorder",
    "notebook.selectedCellBorder",
    "notificationCenter.border",
    "notifications.border",
    "notificationToast.border",
    "panel.border",
    "panel.dropBorder",
    "panelInput.border",
    "panelSection.border",
    "panelSectionHeader.border",
    "panelTitle.activeBorder",
    "peekView.border",
    "peekViewEditor.matchHighlightBorder",
    "pickerGroup.border",
    "sash.hoverBorder",
    "scm.providerBorder",
    "searchEditor.findMatchBorder",
    "searchEditor.textInputBorder",
    "settings.checkboxBorder",
    "settings.dropdownBorder",
    "settings.dropdownListBorder",
    "settings.focusedRowBorder",
    "settings.headerBorder",
    "settings.numberInputBorder",
    "settings.sashBorder",
    "settings.textInputBorder",
    "sideBar.border",
    "sideBarSectionHeader.border",
    "sideBySideEditor.horizontalBorder",
    "sideBySideEditor.verticalBorder",
    "statusBar.border",
    "statusBar.debuggingBorder",
    "statusBar.focusBorder",
    "statusBar.noFolderBorder",
    "statusBarItem.focusBorder",
    "tab.activeBorder",
    "tab.activeBorderTop",
    "tab.activeModifiedBorder",
    "tab.border",
    "tab.hoverBorder",
    "tab.inactiveModifiedBorder",
    "tab.lastPinnedBorder",
    "tab.unfocusedActiveBorder",
    "tab.unfocusedActiveModifiedBorder",
    "tab.unfocusedHoverBorder",
    "tab.unfocusedInactiveModifiedBorder",
    "terminal.border",
    "terminal.findMatchBorder",
    "terminal.findMatchHighlightBorder",
    "terminal.tab.activeBorder",
    "testing.peekBorder",
    "textBlockQuote.border",
    "titleBar.border",
    "tree.tableColumnsBorder",
    "window.activeBorder",
    "window.inactiveBorder"
];

// 1st wizard to select between pre-selection of colors + custom
// returns only color name or custom
function colorChoiceSelect({ example, defaultValue }) {
    let options = [];
    Object.entries(colors).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).forEach(([key, value]) => {
        options.push(
            {
                label: key.toLowerCase(),
                description: value.toUpperCase()
            }
        )
    });
    options.push(
        {
            label: customLabel
        }
    )
    return vscode.window.showQuickPick(options, {
        matchOnDescription: true,
        placeHolder: "Choose an option",
        title: `Enter the accentuation color (for example: ${example})`,
        value: hex2colorName(defaultValue) === customLabel ? defaultValue.toUpperCase() : defaultValue
    });
}

// 2nd wizard to choose a custom color
// returns hexadecimal color or color name from pre-selection of colors
function colorCustomSelect({ example, defaultValue }) {
    return vscode.window.showInputBox({
        placeHolder: "Enter a hexadecimal color",
        prompt: "Enter a hexadecimal color",
        title: `Enter the custom accentuation color (for example: ${example})`,
        value: defaultValue === name2colorHex(defaultValue) ? defaultValue : defaultValue.toLowerCase(),
        valueSelection: defaultValue === name2colorHex(defaultValue) ? [1, 7] : [0, defaultValue.length]
    });
}

// get default setting hexadecimal value from package
// supposes value is always correct
function getDefaultColorHex() {
    return vscode.workspace.getConfiguration().inspect(configPropertyName).defaultValue.toUpperCase();
}

// check if hexadecimal color or color name from pre-selection
function checkThemeColor(color, prefixMsg = "", suffixMsg = "") {
    prefixMsg = prefixMsg + " ";
    if (!color) {
        console.log(`No ${prefixMsg}accentuation color provided${suffixMsg}`);
        return false;
    }
    if (color === "" || color === "#") {
        vscode.window.showErrorMessage(`No ${prefixMsg}accentuation color provided${suffixMsg}`);
        return false;
    }
    // not hexadecimal color and not a color name from pre-selection
    if (!regexHexadecimalColor.test(color) && name2colorHex(color) === color) {
        // if (!regexHexadecimalColor.test(color) && name2colorHex(color) === color && hex2colorName(color) !== customLabel) {
        vscode.window.showErrorMessage(`Wrong ${prefixMsg}accentuation color: must be hexadecimal or one of: ${Object.keys(colors).join(", ")}${suffixMsg}`);
        return false;
    }
    return true;
}

// function activation
async function activate(context) {
    console.log(`Extension ${context.extension.id} is now active!`);
    const config = vscode.workspace.getConfiguration();

    // extension's vscode setting check and auto-reset to default if incorrect
    if (!checkThemeColor(config.get(configPropertyName)?.toUpperCase(), `initial configuration ${configPropertyName} `, ": resetting wrong configuration to default...")) {
        await config.update(configPropertyName, undefined, vscode.ConfigurationTarget.Global);
    }

    // register command to listen for event
    // this command is just a wizard to help to change the value of the vscode setting
    let disposable = vscode.commands.registerCommand(commandName, async () => {
        console.log(`Command ${commandName} invoked`);
        const config = vscode.workspace.getConfiguration();

        // 1st wizard with first color of the pre-selection as example and current extension's vscode setting value
        selectedColor = await colorChoiceSelect({ example: Object.keys(colors)[0], defaultValue: hex2colorName(config.get(configPropertyName)) });
        if (selectedColor.label === customLabel) {
            // custom color selected
            // 2nd wizard with first color of the pre-selection as example and current extension's vscode setting value
            let defaultValue = name2colorHex(config.get(configPropertyName))
            if (config.get(configPropertyName) === defaultValue) {
                // not a hexadecimal value, meaning wrong value, let's take the default value of the extension that we trust
                defaultValue = getDefaultColorHex();
            }
            selectedColor = await colorCustomSelect({ example: name2colorHex(Object.keys(colors)[0]), defaultValue: defaultValue });
            if (checkThemeColor(selectedColor, customLabel)) {
                // custom color is correct, let's update the extension's vscode setting
                await config.update(configPropertyName, name2colorHex(selectedColor), vscode.ConfigurationTarget.Global);
            }
        } else if (checkThemeColor(selectedColor?.label)) {
            // pre-selection color selected, let's update the extension's vscode setting
            await config.update(configPropertyName, selectedColor.description, vscode.ConfigurationTarget.Global);
        }
    });

    context.subscriptions.push(disposable);

    // when configuration has changed (via the command or user manual change of the extension's vscode setting value)
    const configurationChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration(configPropertyName)) {
            // still needs to check the color value in case of user manual change of the extension's vscode setting value
            updateAndCheckThemeColor(vscode.workspace.getConfiguration().get(configPropertyName));
        }
    });

    context.subscriptions.push(configurationChangeListener);

    console.log(`Command ${commandName} registered`);
}

// converts color name to color hexadecimal code
// returns input if not found
function name2colorHex(colorName) {
    if (colors.hasOwnProperty(colorName.toLowerCase())) {
        return colors[colorName.toLowerCase()].toUpperCase();
    }
    return colorName;
}

// converts color hexadecimal code to color name
// returns custom if not found
function hex2colorName(colorHex) {
    for (const [key, value] of Object.entries(colors)) {
        if (colorHex.toUpperCase() === value.toUpperCase()) {
            return key.toLowerCase();
        }
    };
    return customLabel;
}

// read the theme json static file, create/update the values (if needed) with the new accentuation hexadecimal code
// returns if has changed or not
function updateThemeColor(colorHex) {
    const themePath = path.join(__dirname, themeFilePath);
    const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
    let changedFlag = false;
    itemsToUpdate.forEach(item => {
        // hexadecimal colors have to be lowercase in theme settings
        if (!theme.colors[item] || theme.colors[item].toLowerCase() !== colorHex.toLowerCase()) {
            theme.colors[item] = colorHex.toLowerCase(); // Update with new color
            changedFlag = true
        }
    });
    if (changedFlag) {
        fs.writeFileSync(themePath, JSON.stringify(theme, null, 4), "utf8");
    }
    return changedFlag;
}

// check (or recheck in case setting change was performed by command) the color
// in case check is not correct (user manual change of the extension's vscode setting value): reset to default value that we trust
function updateAndCheckThemeColor(color) {
    if (checkThemeColor(color, `configuration ${configPropertyName} `, ": resetting wrong configuration to default...")) {
        colorHex = name2colorHex(color);
    } else {
        colorHex = getDefaultColorHex();
    }

    if (updateThemeColor(colorHex)) {
        vscode.window.showInformationMessage(`Accentuation color changed to ${colorHex} (${hex2colorName(colorHex)})`);
    } else {
        console.log(`Accentuation color was already set to ${colorHex} (${hex2colorName(colorHex)})`);
    }
}

function deactivate() {
    console.log(`Extension ${context.extension.id} is now deactivated!`);
}

module.exports = {
    activate,
    deactivate
};
