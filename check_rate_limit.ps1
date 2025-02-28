try {
    $response = Invoke-WebRequest -Uri "https://bryce-thompson.ghost.io/ghost/api/v3/content/posts/?key=15cf3521699fcc5efae6921948"
    Write-Host "Success! Response Status:" $response.StatusCode
} catch {
    Write-Host "Error Status Code:" $_.Exception.Response.StatusCode.value__
    
    # Get the error response body
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    $reader.DiscardBufferedData()
    $responseBody = $reader.ReadToEnd()
    Write-Host "`nError Response Body:"
    Write-Host $responseBody
    
    # Get current time
    $currentTime = Get-Date
    Write-Host "`nCurrent Time: $currentTime"
}
