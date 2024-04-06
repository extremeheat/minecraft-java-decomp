function convertMappings (mojangData) {
  function remapFilePath (path) {
    const remapPrimitives = { int: 'I', double: 'D', boolean: 'Z', float: 'F', long: 'J', byte: 'B', short: 'S', char: 'C', void: 'V' }
    return remapPrimitives[path]
      ? remapPrimitives[path]
      : `L${path.split('.').join('/')};`
  }

  function removeBracketsAndCount (type, arrayLength) {
    let updatedType = type
    while (updatedType.endsWith('[]')) {
      updatedType = updatedType.slice(0, -2)
      arrayLength++
    }
    return [updatedType, arrayLength]
  }

  const fileContent = mojangData
  const lines = fileContent.split('\n')

  const fileName = {}

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) {
      continue
    }
    // console.log([line])
    const [deobfName, obfName] = line.split(' -> ')
    if (!line.startsWith('    ')) {
      const [obfNameWithoutExtra] = obfName.split(':')
      fileName[remapFilePath(deobfName)] = obfNameWithoutExtra
    }
  }

  const outputLines = []

  for (const line of lines) {
    if (line.startsWith('#') || !line.trim()) {
      continue
    }

    const [deobfName, obfName] = line.split(' -> ')
    if (line.startsWith('    ')) {
      const trimmedObfName = obfName.trim()
      const trimmedDeobfName = deobfName.trim()
      const [methodType, methodName] = trimmedDeobfName.split(' ')
      const cleanMethodType = methodType.split(':').pop()

      if (methodName.includes('(') && methodName.includes(')')) {
        const [functionName, variablesWithParentheses] = methodName.split('(')
        const variables = variablesWithParentheses.slice(0, -1)

        let arrayLengthType = 0
        let remappedMethodType = cleanMethodType;
        [remappedMethodType, arrayLengthType] = removeBracketsAndCount(remappedMethodType, arrayLengthType)
        remappedMethodType = remapFilePath(remappedMethodType)
        remappedMethodType = remappedMethodType in fileName ? `L${fileName[remappedMethodType]};` : remappedMethodType

        if (remappedMethodType.includes('.')) {
          remappedMethodType = remappedMethodType.split('.').join('/')
        }

        for (let i = 0; i < arrayLengthType; i++) {
          if (remappedMethodType.endsWith(';')) {
            remappedMethodType = `[${remappedMethodType.slice(0, -1)};`
          } else {
            remappedMethodType = `[${remappedMethodType}`
          }
        }

        if (variables !== '') {
          const arrayLengthVariables = new Array(variables.length).fill(0)
          const variablesList = variables.split(',')

          const remappedVariables = variablesList.map((variable, index) => {
            let [remappedVariable, arrayLength] = removeBracketsAndCount(variable, arrayLengthVariables[index])
            remappedVariable = remapFilePath(remappedVariable)
            remappedVariable = remappedVariable in fileName ? `L${fileName[remappedVariable]};` : remappedVariable

            if (remappedVariable.includes('.')) {
              remappedVariable = remappedVariable.split('.').join('/')
            }

            for (let i = 0; i < arrayLength; i++) {
              if (remappedVariable.endsWith(';')) {
                remappedVariable = `[${remappedVariable.slice(0, -1)};`
              } else {
                remappedVariable = `[${remappedVariable}`
              }
            }

            return remappedVariable
          })

          const remappedVariablesString = remappedVariables.join('')
          outputLines.push(`\t${trimmedObfName} (${remappedVariablesString})${remappedMethodType} ${functionName}`)
        } else {
          outputLines.push(`\t${trimmedObfName} ()${remappedMethodType} ${functionName}`)
        }
      } else {
        outputLines.push(`\t${trimmedObfName} ${methodName}`)
      }
    } else {
      const [obfNameWithoutExtra] = obfName.split(':')
      const remappedObfName = remapFilePath(obfNameWithoutExtra).slice(1, -1)
      const remappedDeobfName = remapFilePath(deobfName).slice(1, -1)
      outputLines.push(`${remappedObfName} ${remappedDeobfName}`)
    }
  }

  return outputLines.filter(l => !!l).join('\n')
}

module.exports = { convertMappingsMojang2TSRG: convertMappings }
