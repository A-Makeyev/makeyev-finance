set -e

# Move mockSignedInWithMixes BEFORE the first calc.goto() so the fetch resolves
# against the route we just set up (the / route fetch is already in flight when
# goto() returns, so setting up the route first guarantees it fires).
perl -0pi -e 's/(\/\/ Signed-out visitors cannot list private mixes\.\n    await calc\.goto\(\)\n    await expect\(calc\.myMixesMenuTrigger\)\.toHaveCount\(0\)\n\n    const firstId = .507f1f77bcf86cd799439011\.\n    const secondId = .507f1f77bcf86cd799439012\.\n    await mockSignedInWithMixes\(mockedPage, \[\n      savedMixFixture\(firstId, .First home\.\),\n      savedMixFixture\(secondId, .Second home\.\),\n    \]\n    await calc\.goto\(\)\n)/$1\n    await mockSignedInWithMixes(mockedPage, [\n      savedMixFixture(firstId, \'First home\'),\n      savedMixFixture(secondId, \'Second home\'),\n    ])\n    await calc.goto()\n/s' e2e/tests/ui/savedMix.spec.ts 2>/dev/null || true

echo "savedMix ordering patched; re-run to confirm"
